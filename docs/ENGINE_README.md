# 光年之外 · 高保真动态插画 MV | 工程脚手架

**内容：** 完整 43 镜时间轴及 43 份 `shot.json`、逐帧确定性 1920×1080 Canvas 合成引擎、Pillow 离线 PNG 序列导出器（已完成小规模实测）、可选的 Chromium 导出器、校验脚本、你的宇航员水彩原画 DEMO。

**这不是已经制作完成的 43 镜视频。** 除 `DEMO` 外的正式镜头资产均标记为 `TODO`。不会声称自动完成抠图、补背景、人物动作或镜头转场。每个镜头内的 `design.motionPreset` 和 `transitionOut` 是制作标注，不代表已自动实现。当前引擎已实现固定素材合成、摄像机平移/缩放/旋转、图层位置/缩放与不透明度插值、`radial-in` / `radial-out` / 两种水平 reveal，以及径向光晕。其他特效和转场需要后续实现。

## 一、如何运行（Windows 11、Node.js 22+）

1. 将 ZIP 解压到项目旁边。预览需要 Node.js 22+ 和 Chrome/Edge；离线渲染则只需要 Python 3.10+、Pillow 和 FFmpeg。
2. 在目录下执行 `npm run validate`，检查 43 镜时间区间。
3. 执行 `npm run preview`，浏览器打开 `http://127.0.0.1:4173/preview.html`。
4. 默认选择 `DEMO`，可以看到**原图不重新绘制**的慢推镜头，支持拖动时间与播放。
5. **推荐稳定的离线渲染器：** 先运行 `python -m pip install pillow`，再执行 `python scripts/render_png.py --shot DEMO --count 48`，输出 48 帧 PNG 到 `output/demo_frames/`。也提供 `npm run render:demo`（Chromium 导出器），但部分无图形环境可能启动失败。
6. 使用 FFmpeg：

   ```bash
   ffmpeg -y -framerate 24 -start_number 0 -i output/demo_frames/%06d.png -c:v libx264 -pix_fmt yuv420p -crf 17 -movflags +faststart output/demo.mp4
   ```

   Windows PowerShell 也可直接执行上面的 FFmpeg 命令（安装并加入 PATH 后）。如果未找到浏览器，设置环境变量 `CHROME_PATH` 指向本机 `chrome.exe` 或 `msedge.exe`。

## 二、真正开始 S05

`shots/S05/shot.json` 已有正式 `startFrame` 对应的时间轴（位于 `timeline.json`），但正式素材未准备。

1. 将原画放到 `assets/shots/S05/hero.png`，只供构图参照，**不直接与拆出的运动层叠加**。
2. 在 Krita 中抠出需要移动的星球、霜、舷窗边框等，修补被移走部分的背景，输出 `assets/shots/S05/plate.png`。
3. 透明素材放到 `assets/shots/S05/layers/planet.png`、`frost.png`、`window_frame.png`。**请让图层保持完整 1920×1080 透明画布和原始坐标**（不要裁成紧贴边界的小 PNG），否则对位会改变。
4. 修改 `shots/S05/shot.json` 中相关图层的 `motion`、`opacityFrom`/`opacityTo` 和 `reveal` 参数；将 `assetStatus` 改为 `READY`。
5. 运行 `python scripts/render_png.py --shot S05`（推荐），或 `npm run render -- --shot S05`（浏览器方式）。对应全局帧号会输出到 `output/frames/000546.png` 等名称。
6. 首次正式渲染前运行 `npm run validate -- --assets`。整个项目 43 镜都准备好后，严格检查才能通过。

注意：只用完整 `hero.png` 作为单层进行轻推完全可以，尤其 T1 镜头。如果需要把其中的星球或人物独立移动，必须做清理底板（clean plate），否则在原图中留下“双重星球/人物”。

## 三、文件与时间规范

- `project.json`：1920×1080 / 24fps / 227.375s / 5457 帧。
- `timeline.json`：**唯一时间轴真值**。所有镜头 `[startFrame,endFrame)`，相邻边界共用但不重叠。由原分镜秒数 `round(seconds*24)` 得到。
- `docs/SHOT_INDEX.json`：43 镜动作、镜头类型、建议图层与转场索引。
- `shots/SXX/shot.json`：具体运动与合成参数，不重复存入秒数，避免双真值。
- `assets/shots/SXX/hero.png`：高保真母图，仅作为原画参照。
- `assets/shots/SXX/plate.png`：补全后的静态背景，实际渲染必需。
- `assets/shots/SXX/layers/*.png`：完整画布透明主体、光影或蒙版。缺少标记 `required:false` 的素材时会跳过。
- `assets/reference/astronaut_reference.png`：本次上传的原画，仅作为 DEMO 原图，非 S05 完成稿。
- `output/`：导出的序列和视频，禁止提交仓库。

推荐颜色：`#0A1422`、`#2C3B4F`、`#7FD8D8`、`#E8A33D`、`#EDE7DA`。字幕安全区 y=975–1070，所有重要动作尽量保持 y<960。

## 四、验证与输出命令

Python 离线渲染器经过本环境 1920×1080 PNG 输出实测；Chromium 版脚本已经完成语法检查，但当前运行容器的 Chromium 本身无法正常导航（连 data: 页面测试也超时），因此**不宣称已完成 Chromium 导出端到端验证**。在本机运行若遇到问题，优先采用 Python 版本。

```
npm run validate                         # 校验时间轴和 43 份配置，不要求美术素材齐全
npm run validate -- --assets             # 严格检查全部正式素材是否准备好
npm run preview                          # 预览/拖动时间
npm run render:demo                      # 导出 DEMO 的前 48 帧
npm run render -- --shot S05             # 导出 S05 正式帧，必须备齐素材
npm run render -- --shot S05 --count 24  # S05 前 24 帧测试
npm run render -- --shot S05 --allow-placeholder # 测试缺图场景，输出占位，不可作为成片
npm run render                           # 全 43 镜批量输出（素材全部就绪后）
python scripts/render_png.py --shot DEMO --count 48    # 推荐、已实测
python scripts/render_png.py --shot S05                # 正式镜头（备齐素材后）
python scripts/render_png.py --shot ALL                # 全片（备齐素材后）
```

只有 DEMO 是真实可见的示例。任何正式镜头导出默认必须检查必需素材。`--allow-placeholder` 只用于开发检查，不代表完成该镜头。

## 五、后续引擎整合

本脚手架同时包含浏览器 Canvas2D 交互预览与 Python Pillow 离线序列输出。两种渲染器都以镜头绝对时间作为运动来源。出片以实测过的 Pillow 离线版为先；极细节差别仍应以最终选定的单一渲染器为准。已有 p5.js / p5.brush 引擎可以保留作为 **星轨、冰霜、墨线、星尘等独立透明效果层/离线资产生成器**，无需再用 p5.brush 重画人物和整幅水彩。不要用每帧新随机的笔刷/纸纹。

未包含：全息光幕扫描线真实实现、二维人物动作/形变插帧、图像分割、背景补洞、ASS 字幕的逐字歌词时间轴、跨镜头转场。这些必须在样片验收后逐步补齐。特别是动态插画不能从一幅全身静态画自动推导可靠的拥抱动作。

## 六、版权与发布

未分发歌曲音频，需自行确认歌曲、录音、歌词、视觉素材以及公开发布/传播的授权。`assets/audio/` 被 `.gitignore` 忽略，勿提交商业录音。字幕请根据合法获取的时间戳另行制作，整片主画面不要直接烧录文字。
