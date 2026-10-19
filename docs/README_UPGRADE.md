# 《光年之外》MV 项目套件升级说明 (v0.2)

本套件包含了修复与增强后的离线合成渲染器（支持 Screen/Add 高级水彩光效与固定冷压纸纹）、音乐节拍自动提取脚本（`extract_beats.py`），以及完整的开发与资产管理指南。

## 一、 文件结构规范 (`guangnian-mv/`)
```
guangnian-mv/
├── project.json                 # 全局参数 (1920x1080, 24fps, 5457帧)
├── timeline.json                # 43 镜绝对时间轴真值
├── shots/                       # 43 镜独立 shot.json 文件夹
├── assets/
    ├── audio/clip.m4a           # 音频源文件
    ├── reference/
        ├── astronaut_reference.png # 宇航员原画参考
        └── paper_grain.png      # 固定冷压水彩纸纹贴图
    └── shots/SXX/               # 各镜头的 plate.png 及 layers/*.png
├── scripts/
    ├── render_png.py            # 增强版 Pillow 离线渲染器 (含 Screen/Add)
    └── extract_beats.py         # 音频节拍提取脚本
└── docs/
    ├── STORYBOARD_REFINED.md    # 细化分镜脚本与母题规范
    └── beats.json               # 音频卡点时间戳
```

## 二、 核心资产命名与分层铁律
1. **plate.png**：必须是抠除运动主体后、通过修补画笔完美修复背景的无缝 1920x1080 底板。
2. **layers/*.png**：透明前景主体（如左手、右手、光幕、霜花、星球），必须保持全画幅 1920x1080 尺寸，严禁裁剪边缘。
3. **纸纹质感**：放置于 `assets/reference/paper_grain.png` 的冷压纸纹不随相机推移而缩放，确保手绘水彩电影感。

## 三、 本地安装记录（2026-10-19 合并时补充）

1. **ZIP 里的 `render_png.py` 缺少 CLI 入口**：v0.2 包中只有函数定义，没有 `argparse/main`，直接运行会静默退出。已从 v0.1 恢复入口并合并到 v0.2 主体，命令用法不变：
   - `python scripts/render_png.py --shot DEMO --count 48`
   - `python scripts/render_png.py --shot S05 --allow-placeholder`
2. **固定纸纹尚未提供**：仓库中还没有 `assets/reference/paper_grain.png`。缺失时渲染器自动跳过纸纹叠加；放入该文件后无需改代码即生效（已用临时纹理验证此分支可用，验证后已删除临时文件）。
3. **节拍尚未生成**：`extract_beats.py` 需要 `librosa` + `soundfile`，解码 m4a 通常还需要 FFmpeg；当前环境两者都未安装，因此 `docs/beats.json` 尚未生成。
4. **音频路径不一致**：`project.json` 写的是 `assets/audio/clip.m4a`，本机音频实际在 `assets/clip.m4a`（且被 .gitignore 忽略）。运行节拍提取时请显式传入实际路径。
