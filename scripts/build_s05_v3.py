#!/usr/bin/env python3
"""Build S05 staged-frost and darker-planet derived assets from existing RGBA PNGs.

Runs locally in the existing guangnian-mv repository. No frame-to-frame AI and no
modifications to current engine are required. By default it does not change
shot.json; pass --apply to install with a backup under output/backups.

Dependencies: Pillow, numpy.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys
import numpy as np
from PIL import Image


def as_rgba(path: Path) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(f'Missing: {path}')
    with Image.open(path) as im:
        if 'A' not in im.getbands():
            raise ValueError(f'{path.name} has no alpha channel. Real transparency is required.')
        return im.convert('RGBA').copy()


def make_layers(root: Path, bands: int, brightness: float):
    shot_dir = root / 'shots' / 'S05'
    layer_dir = shot_dir / 'layers'
    full = as_rgba(layer_dir / 'frost_full.png')
    planet = as_rgba(layer_dir / 'planet_lit.png')
    with Image.open(shot_dir / 'plate.png') as pl:
        sz = pl.size
    if planet.size != sz or full.size != sz:
        raise ValueError(f'Sizes differ: plate={sz}, planet={planet.size}, frost={full.size}. Do not scale assets independently.')
    width, height = sz
    fa = np.array(full, dtype=np.uint8)
    pa = np.array(planet, dtype=np.uint8)
    for name, arr in [('frost', fa), ('planet', pa)]:
        a = arr[:, :, 3]
        if a.min() > 0 or a.max() == 0:
            raise ValueError(f'{name} alpha range {a.min()}..{a.max()} looks invalid')

    # Darken existing color pixels only; alpha and geometry are bit-identical.
    dark = pa.copy()
    cold_factors = np.array([brightness * .90, brightness * .98, min(1., brightness * 1.08)], dtype=np.float32)
    dark[:, :, :3] = np.clip(np.round(pa[:, :, :3].astype(np.float32) * cold_factors), 0, 255).astype(np.uint8)
    dark[:, :, 3] = pa[:, :, 3]
    Image.fromarray(dark, 'RGBA').save(layer_dir / 'planet_dark.png', optimize=True)

    # A stable spatial arrival-time map: ring-edge first, then progressively
    # inward. Left/bottom precede right, with deterministic spatial distortion
    # so a crystalline boundary feels less mechanical. No per-frame randomness.
    y, x = np.ogrid[:height, :width]
    x = x.astype(np.float32)
    y = y.astype(np.float32)
    cx, cy = .592 * width, .118 * height
    rim_radius = .601 * height
    depth_width = .245 * height
    radial = np.hypot(x - cx, y - cy)
    inward = np.clip((rim_radius - radial) / depth_width, 0., 1.)
    rightward = np.clip((x - .24 * width) / (.72 * width), 0., 1.)
    # Smooth deterministic undulations—not newly generated watercolor detail.
    waviness = (np.sin(x * .033 + y * .018) * np.sin(y * .051 - x * .012)) * .045
    arrival = np.clip(.56 * inward + .40 * rightward + waviness, 0., 1. - 1e-7)
    indices = np.floor(arrival * bands).astype(np.uint8)
    orig_alpha = fa[:, :, 3].copy()
    layer_dir.mkdir(parents=True, exist_ok=True)
    check = np.zeros((height, width), dtype=np.uint16)
    stage_paths = []
    for n in range(bands):
        part = fa.copy()
        chosen = (indices == n)
        part[:, :, 3] = np.where(chosen, orig_alpha, 0).astype(np.uint8)
        check += part[:, :, 3].astype(np.uint16)
        name = f'frost_growth_{n + 1:02d}.png'
        Image.fromarray(part, 'RGBA').save(layer_dir / name, optimize=True)
        stage_paths.append(name)
    if not np.array_equal(check, orig_alpha.astype(np.uint16)):
        raise AssertionError('Frost mask slices did not reconstruct original alpha exactly')
    print(f'Generated dark planet + {bands} disjoint frost stages. Dimension {sz}.')
    print(f'Alpha partition validated: each source frost pixel belongs to exactly one stage.')
    print('Note: this approximates staged crystalline growth; it is not branch-level physical simulation.')
    return stage_paths


def build_config(root: Path, paths: list[str]) -> dict:
    cfg_path = root / 'shots' / 'S05' / 'shot.json'
    cfg = json.loads(cfg_path.read_text(encoding='utf-8'))
    if cfg.get('id') != 'S05':
        raise ValueError('Expected S05 shot.json')
    layers = cfg['layers']
    plate = next((x for x in layers if x.get('id') == 'plate'), None)
    planet = next((x for x in layers if x.get('id') == 'planet_lit'), None)
    if not plate or not planet:
        raise ValueError('Expected existing plate and planet_lit layers; patch depends on their real positions.')
    plate['blend'] = 'source-over'
    planet['blend'] = 'source-over'
    planet['opacity'] = 1
    planet.pop('opacityKeys', None)
    planet['required'] = True

    dark = json.loads(json.dumps(planet))
    dark['id'] = 'planet_dark'
    dark['src'] = 'shots/S05/layers/planet_dark.png'
    dark.pop('opacity', None)
    dark['opacityKeys'] = [
      {'t':0.,'value':0.}, {'t':.34,'value':0.},
      {'t':.72,'value':.50}, {'t':1.,'value':.88}
    ]
    new = [plate, planet, dark]
    bands = len(paths)
    for n, fname in enumerate(paths):
        # Each alpha-disjoint stage appears one after another. At the end,
        # the accumulation exactly reproduces the supplied frost transparency.
        st = .08 + .74 * (n / bands)
        en = min(1., st + .22)
        new.append({
          'id':f'frost_growth_{n + 1:02d}',
          'src':f'shots/S05/layers/{fname}',
          'required':True, 'fit':'cover', 'opacity':1,
          'blend':'source-over', 'parallax':1,
          'opacityKeys':[
            {'t':0.,'value':0.},
            {'t':round(st,4),'value':0.},
            {'t':round(en,4),'value':1.},
            {'t':1.,'value':1.}
          ]
        })
    cfg['layers'] = new
    cfg['assetStatus'] = 'READY'
    cfg['notes'] = ('S05 v3: source plate, identical-motion lit+dark planet derived from one original PNG; '
       'ice grows in alpha-disjoint spatial stages from the existing frost PNG. '
       'All changes are deterministic. Stage layer masks do not redraw frost. '
       'For absolute per-branch growth, add an explicit continuous reveal mask later.')
    return cfg


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1], help='guangnian-mv root')
    parser.add_argument('--bands', type=int, default=7)
    parser.add_argument('--brightness', type=float, default=.59)
    parser.add_argument('--apply', action='store_true', help='Backup and update shots/S05/shot.json')
    args = parser.parse_args()
    if not (3 <= args.bands <= 12): parser.error('bands must be 3..12')
    if not (.2 <= args.brightness <= .95): parser.error('brightness must be between .2 and .95')
    root = args.root.resolve()
    if not (root/'project.json').exists(): parser.error(f'Not a guangnian-mv project root: {root}')
    paths=make_layers(root,args.bands,args.brightness)
    conf=build_config(root,paths)
    suggested=root/'output'/'S05_v3_shot.json'
    suggested.parent.mkdir(parents=True, exist_ok=True)
    suggested.write_text(json.dumps(conf,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Generated config candidate: {suggested}')
    if args.apply:
        target=root/'shots'/'S05'/'shot.json'
        backup=root/'output'/'backups'/'S05_before_v3.json'
        backup.parent.mkdir(parents=True, exist_ok=True)
        backup.write_bytes(target.read_bytes())
        target.write_text(json.dumps(conf,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(f'Updated {target} (backup: {backup})')
    else:
        print('Current shot.json UNCHANGED. Add --apply to install config.')
    print('Then run: npm run validate && npm run preview')

if __name__=='__main__': main()
