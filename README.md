# DreamVideo

一个面向 Coding Agent 的本地 AI 短视频画布，以 **Dreamina Seedance 2.5** 作为默认视频模型。

它把一句创意拆成可审阅、可修改、可重复生成的完整链路：

```text
创意 → 故事板 → 场景 → 首帧 / 中间帧 / 尾帧 → Seedance 视频
```

项目状态保存在本地 JSON 中，生成的图片和视频也保留在本机。你可以让 Codex、Claude Code、Cursor 或其他 Coding Agent 搭建分镜，再通过浏览器画布检查 Prompt 和逐个生成素材。

## 核心能力

- 默认使用 Dreamina `seedance2.5` 生成视频。
- 每个场景使用首帧、中间帧、尾帧三张参考图，增强人物和场景连续性。
- 支持 9:16、1:1、16:9、4:3、3:4 等画幅。
- 本地浏览器审阅界面，可编辑 Prompt、切换 Provider、单独生成镜头。
- 图片支持 Codex 或 Grok，视频支持 Dreamina 或 Grok。
- Dreamina 使用官方 CLI OAuth 登录，不需要把 API Key 写入项目。
- 旧版项目自动迁移，视频节点带有明确的 Provider 配置。

## 工作方式

```text
Storyboard（完整多格故事板）
  └── Scene（一个约 6 秒的剧情段落）
        ├── First frame
        ├── Middle frame
        ├── Last frame
        └── Video（Dreamina multimodal2video）
```

默认的视频调用等价于：

```bash
dreamina multimodal2video \
  --image first.png \
  --image middle.png \
  --image last.png \
  --model_version seedance2.5 \
  --video_resolution 720p \
  --ratio 9:16 \
  --duration 6 \
  --prompt "..."
```

任务提交后，画布会等待异步生成完成、下载视频，并保存到 `canvas/assets/`。

## 环境要求

- Node.js 20+
- Dreamina 官方 CLI
- 可使用 Seedance 2.5 的 Dreamina VIP 账号
- 可选：Codex CLI，用于生成故事板和关键帧
- 可选：Grok Build CLI，作为图片或视频的备用 Provider

## 安装

```bash
git clone https://github.com/realruian/dream-video.git
cd dream-video
npm install
```

登录 Dreamina：

```bash
dreamina login
```

部分账号首次使用 Seedance 2.5 时，需要先在即梦网页端完成一次模型确认生成。

## 快速开始

初始化项目：

```bash
npm run canvas -- init "我的短片"
```

启动本地审阅画布：

```bash
npm run canvas -- serve --no-open
```

访问：<http://localhost:4180>

添加故事板：

```bash
npm run canvas -- add image \
  --provider codex \
  --aspect 9:16 \
  --id img-1 \
  --prompt "一张完整的 8 格竖屏电影故事板，统一人物和场景，无文字，无水印"

npm run canvas -- storyboard set img-1
```

创建场景：

```bash
npm run canvas -- scene add \
  --name "Opening" \
  --panels 1-4 \
  --provider codex \
  --video-provider dreamina \
  --duration 6
```

生成顺序：

1. 故事板
2. 场景首帧 / 中间帧 / 尾帧
3. Seedance 视频

可以在 UI 中逐个点击 Generate / Animate，也可以明确指定镜头：

```bash
npm run canvas -- run --shot vid-1
```

生成会消耗 Provider 额度。请在运行前检查 Prompt、参考图和目标镜头，避免直接运行全部 pending 任务。

## 常用命令

| 命令 | 用途 |
|---|---|
| `canvas init [name]` | 创建 `canvas/project.json` |
| `canvas storyboard set <id>` | 设置主故事板 |
| `canvas scene add ...` | 创建三张关键帧和一个视频节点 |
| `canvas add image ...` | 添加自由图片节点 |
| `canvas add video ...` | 添加自由视频节点 |
| `canvas set <id> --prompt ...` | 修改 Prompt 并标记为 pending |
| `canvas run [--shot id]` | 生成全部或指定镜头 |
| `canvas status` | 查看项目和生成状态 |
| `canvas serve --no-open` | 启动本地审阅界面 |

新场景默认使用 Dreamina：

```bash
npm run canvas -- scene add \
  --name "Scene 1" \
  --video-provider dreamina
```

自由视频节点也可以明确选择 Provider：

```bash
npm run canvas -- add video \
  --from img-2 \
  --refs img-3,img-4 \
  --provider dreamina \
  --duration 6 \
  --prompt "人物完成一个连贯动作，保持面部、服装和场景一致"
```

## Dreamina 配置

默认配置：

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `CANVAS_DREAMINA_BIN` | `dreamina` | Dreamina CLI 路径 |
| `CANVAS_DREAMINA_MODEL` | `seedance2.5` | 视频模型 |
| `CANVAS_DREAMINA_RESOLUTION` | `720p` | 输出分辨率 |
| `CANVAS_DREAMINA_POLL_SECONDS` | `900` | 最长轮询时间 |

可以放入项目根目录的 `.env.local`：

```dotenv
CANVAS_DREAMINA_MODEL=seedance2.5
CANVAS_DREAMINA_RESOLUTION=720p
CANVAS_DREAMINA_POLL_SECONDS=900
```

不要提交登录凭据、Token、`.env` 或 `.env.local`。

## 项目文件

```text
canvas/
├── project.json     # Prompt、场景、依赖和状态
└── assets/          # 生成的图片和视频
```

`canvas/` 默认不会提交到 Git。你可以按自己的协作需求调整忽略策略，但不要意外发布真人参考照片或未授权素材。

## 开发与验证

```bash
npm test
npm run typecheck
```

测试不会调用模型，也不会消耗 Dreamina 积分。

## 当前限制

- 画布目前将单个场景限制为 6 秒或 10 秒。
- Seedance 2.5 在当前 CLI 中最高输出 720p。
- 视频生成前，所有参考关键帧必须已经生成完成。
- 多场景成片仍需使用剪辑工具进行拼接、配乐和字幕处理。

## License 与致谢

本项目基于 [AsadMoulviDev/reel-video](https://github.com/AsadMoulviDev/reel-video) 开发，原项目及本项目均遵循 MIT License。原版权声明和许可文本保留在 [LICENSE](LICENSE) 中。

Dreamina、Seedance、Codex 和 Grok 是其各自权利人的产品或商标；本项目与这些平台不存在官方从属关系。
