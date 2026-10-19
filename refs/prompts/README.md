# refs/prompts · 外包 Prompt 使用说明

这个目录里每个 .txt 是一条**已经拼好风格块**的 prompt，复制即可用。
总说明和完整清单见 `mv/docs/OUTSOURCE_PROMPTS.md`。

## 使用顺序

1. **先出风格锚**：`prompt_style_verse.txt` → `ref_verse.png`，出 4 张选 1 张。
2. **再出角色**：`prompt_pilot_turnaround.txt` → `pilot_turnaround.png`，
   之后所有角色图都用它当 `--cref` / 参考图。
3. **再出其他图**：`prompt_hero_*.txt`、`prompt_holo_ta.txt`、`prompt_prop_watch.txt`、
   `prompt_eye_closeup.txt`、`prompt_pilot_expressions.txt`、`prompt_style_chorus/outro.txt`，
   全部用风格锚做参考，保证不漂移。
4. **并行的文本工作**：
   - `prompt_storyboard_llm.txt` → 贴给 Claude / GPT 润色 43 镜头
   - `prompt_palette_extract.txt` → 让视觉模型出 palette.json
   - `prompt_review_vision.txt` → 每轮渲染后对比打分
5. **运动参考**（可选）：`prompt_video_chorus_orbit.txt`、`prompt_video_s37_embrace.txt`
6. **交接**：refs 存好后，把 `prompt_handoff_opencode.txt` 贴进 OpenCode 会话。

## 文件与产物对照

| prompt 文件 | 产物 |
|---|---|
| prompt_style_verse.txt | ref_verse.png |
| prompt_style_chorus.txt | ref_chorus.png |
| prompt_style_outro.txt | ref_outro.png |
| prompt_pilot_turnaround.txt | pilot_turnaround.png |
| prompt_pilot_expressions.txt | pilot_expressions.png |
| prompt_holo_ta.txt | holo_ta.png |
| prompt_prop_watch.txt | prop_watch.png |
| prompt_eye_closeup.txt | eye_closeup.png |
| prompt_hero_s01.txt ... prompt_hero_s37.txt | hero_s01.png ... hero_s37.png |
| prompt_hero_s12.txt | hero_s12.png（隔窗守候） |
| prompt_hero_s25.txt | hero_s25.png（光幕之隔） |
| prompt_hero_s35.txt | hero_s35.png（碎裂成星尘） |
| prompt_hero_aurora.txt | hero_aurora.png |
| prompt_storyboard_llm.txt | 分镜细化表（文本） |
| prompt_review_vision.txt | 评审表（文本） |
| prompt_palette_extract.txt | palette.json |
| prompt_video_*.txt | 运动参考视频 |
| prompt_handoff_opencode.txt | OpenCode 对齐指令 |

## 三件注意

1. 每条 prompt 的【PROMPT】段已经含 16:9 / 纸纹 / 防纯黑纯白 / 字幕带留空；**不要删**。
2. Midjourney 才加最后的【追加参数】；Flux / 即梦 / 可灵把【NEGATIVE】填进负向框。
3. 生成图只作**参考和贴图**，最终帧仍由 OpenCode 用 paint/inkLine 画；别直接把图当视频帧。
4. `prompt_hero_s12/s25/s35.txt` 来自分镜对话里的“补齐三条 Hero”一轮，负向词已写在 PROMPT 段内部（没有单独的【NEGATIVE】小节）；Midjourney 仍可追加末尾参数。
