#!/usr/bin/env python3
"""Audio Beat Extractor using librosa (pip install librosa)
Generates beats.json time markers for precise MV editorial pacing.
"""
import json, sys
from pathlib import Path

def extract_beats(audio_path, output_json):
    try:
        import librosa
        print(f"Analyzing audio: {audio_path} ...")
        y, sr = librosa.load(audio_path)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr).tolist()
        
        data = {
            "tempo": float(tempo),
            "beatCount": len(beat_times),
            "beats": beat_times
        }
        Path(output_json).write_text(json.dumps(data, indent=2), encoding='utf-8')
        print(f"Successfully exported {len(beat_times)} beat markers to {output_json}")
    except ImportError:
        print("Error: librosa is not installed. Run: pip install librosa soundfile")

if __name__ == '__main__':
    audio = sys.argv[1] if len(sys.argv) > 1 else "assets/audio/clip.m4a"
    out = sys.argv[2] if len(sys.argv) > 2 else "docs/beats.json"
    extract_beats(audio, out)
