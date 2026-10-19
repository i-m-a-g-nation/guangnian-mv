# 光年之外 · 手绘水彩 MV（规划与参考包）

G.E.M.《光年之外》的手绘水彩风 MV 项目：**分镜、风格参考、绘制规则**。
本仓库是「规划与参考包」，用于和网页版 AI 对齐画面方向；**不含音频、不含实现代码**。

## 当前状态

- 分镜已精修：`docs/STORYBOARD_REFINED.md`（43 镜，S01–S43，含景别/机位/构图/光位/色板/转场/可实现性）
- 风格目标：**平涂手绘水彩（flat）**，以 `refs/ref_verse_flat.png` 为准
- 旧精细水彩参考：`refs/ref_verse.png` 仅作情绪/mood，不作复刻目标
- 画面实现（程序化引擎、校准版本 v1–v3）在本地归档，未上传；当前校准进度：S01 舱内段 R3（调色/明度）

## 文件结构

```
STORYBOARD.md               原始分镜（43 镜）
docs/STORYBOARD_REFINED.md  精修分镜（工作版）
refs/                       风格与角色参考（已缩放到宽 1280，便于网页查看）
  ├─ ref_verse_flat.png     ★ 主歌正式目标（可复刻版）
  ├─ ref_verse.png          精细水彩（mood）
  ├─ ref_chorus.png         副歌锚（金紫对撞）
  ├─ ref_outro.png          尾声锚（极光白）
  ├─ hero_s01/05/12/25/35/37.png  六张关键帧参考
  ├─ pilot_turnaround.png / pilot_expressions.png   领航员
  ├─ eye_closeup.png / prop_watch.png / holo_ta.png  细节
  ├─ palette.json           色板与规则
  ├─ README.md              参考图索引与落地规则
  └─ prompts/               文生图/评审/交接提示词
```

## 给网页 AI 的对齐方式

把本仓库链接贴给网页版 AI，并说明：

1. **目标画面**：`refs/ref_verse_flat.png`（平涂水彩、色块 ≤10、湿画法 + 纸纹）；
2. **镜头语言**：`docs/STORYBOARD_REFINED.md` 的分镜表；
3. **色板**：`refs/palette.json`（禁纯黑/纯白；最暗 `#060A10`，最亮 `#EDE7DA`）；
4. **验收**：25% 缩略图下，形状与色块分布接近 flat 目标即可，不追求像素级。

## 硬性规则

- 禁纯黑 `#000000` / 纯白 `#FFFFFF`；主体内容在 y<960，字幕带 y=975–1070 保持暗而干净；
- 禁写实正脸、现代城市、机甲、怪物、血腥；人物只留面罩/剪影/眼睛局部；
- 金色只做光，不做贴图；主歌金色面积 <2%；
- 一次只改一个维度：形 → 色 → 光 → 笔触，每轮出检查图。

## 版权

仓库不含歌曲音频；音乐文件仅在本地使用。
