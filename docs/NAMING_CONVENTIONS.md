# 文件与原画命名规范（V0.1）

## 固定约定

- 43 镜按 `S01` ... `S43`，章节 `C01` ... `C11`。
- 镜头目录只使用 `shots/SXX/`，画面数据只使用 `assets/shots/SXX/`。
- 画面为完整 1920×1080 画布、透明 PNG（包括小小一只手，不应裁边后失去原始坐标）。
- 标准文件名 `hero.png`、`plate.png`，其余小写下划线 `left_hand.png` 等，与对应 `shot.json` 的 `layer.src` 严格一致。
- 调整原画时建议保留版本历史在 `work/SXX/SXX_hero_v001.kra`、`SXX_hero_v002.kra`，经审核后导出为固定的 `hero.png`，这样程序路径不会随版本号变化。
- `hero.png` 是完整母图，不应与移动的人物 PNG 叠加；要先修补生成 `plate.png`。

## 资产目录示意

```
work/S25/S25_hero_v001.kra       # 源文件，建议本地保存
assets/shots/S25/hero.png        # 整幅参考原画
assets/shots/S25/plate.png       # 已修补背景
assets/shots/S25/layers/left_hand.png
assets/shots/S25/layers/right_hand.png
assets/shots/S25/layers/light_membrane.png
assets/shots/S25/layers/ripples.png
shots/S25/shot.json
```

## 动画规则

- 以绝对全局帧号为唯一时间，`startFrame` 包含、`endFrame` 不包含。
- 所有图层采用统一画布坐标，以 `x=0..1920`、`y=0..1080` 表示。
- `camera.from/to` 做整镜相机运动；`layer.motion.from/to` 做图层局部位移、缩放、旋转。
- `layer.opacityKeys` 是相对镜头 `[0,1]` 的姿态切换时间，适用于眼睛、握拳、拥抱等有限姿态变化；注意简单交叉淡化无法真正计算形体中间姿态。
- `layer.reveal` 用遮罩渐显，当前支持 `radial-in`、`radial-out`、`wipe-left`、`wipe-right`。
- 复杂霜纹建议离线制作不规则生长蒙版序列，再扩展合成器读取，不要依赖每帧随机笔刷。
- 独立歌词/字幕层放在最终合成步骤，镜头画面只提供 `subtitleSafeArea` 元信息；不自动下压原画底部，免得损失源美术。
