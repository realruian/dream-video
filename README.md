[English](README.md) | [简体中文](README.zh-CN.md)

# DreamVideo

**DreamVideo** is a local AI short-video creation workbench built for Coding Agents. By default, it uses an end-to-end Dreamina pipeline: **Dreamina 5.0** for storyboards and keyframes, and **Dreamina Seedance 2.5** for video generation.

It breaks a single creative idea into a reviewable, editable, and reproducible pipeline:

```text
Idea → Generate Storyboard → User Confirms Storyboard → Generate First / Middle / Last Frames → User Confirms Video Settings → Seedance Video
```

Project state is stored in local JSON, and generated images and videos stay on your machine. You can have Codex, Claude Code, Cursor, or another Coding Agent assemble the storyboard and shots, then inspect prompts and generate assets one by one in the local browser canvas.

## Key Capabilities

- Uses Dreamina `5.0` for storyboards and keyframes and `seedance2.5` for video generation by default.
- Uses three reference images per scene (first, middle, and last frames) for stronger character and scene continuity.
- Supports `9:16`, `1:1`, `16:9`, `4:3`, and `3:4` aspect ratios.
- Includes a local browser review canvas to edit prompts, switch providers, and generate individual shots.
- Supports Dreamina, Codex, or Grok for images, and Dreamina or Grok for videos.
- Authenticates via the official Dreamina CLI OAuth login—no API keys stored in the project.
- Automatically migrates legacy projects and attaches explicit provider configuration to video nodes.

## How It Works

```text
Storyboard (full multi-panel storyboard)
  └── Scene (a ~6-second narrative segment)
        ├── First frame
        ├── Middle frame
        ├── Last frame
        └── Video (Dreamina multimodal2video)
```

The default video invocation is equivalent to:

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

After submitting a task, the canvas waits for asynchronous generation to finish, downloads the video, and saves it to `canvas/assets/`.

## Requirements

- Node.js 20+
- Official Dreamina CLI
- Dreamina VIP account with access to Seedance 2.5
- Optional: Codex CLI as a fallback image provider
- Optional: Grok Build CLI as a fallback image or video provider

## Installation

```bash
git clone https://github.com/realruian/dream-video.git
cd dream-video
npm install
```

Sign in to Dreamina:

```bash
dreamina login
```

Some accounts must complete a one-time model confirmation generation on the Dreamina web app before using Seedance 2.5 for the first time.

## Quick Start

Initialize a project:

```bash
npm run dream-video -- init "My Short Film"
```

Start the local review canvas:

```bash
npm run dream-video -- serve --no-open
```

Open: <http://localhost:4180>

Add a storyboard:

```bash
npm run dream-video -- add image \
  --provider dreamina \
  --aspect 9:16 \
  --id img-1 \
  --prompt "8-panel cinematic storyboard for a vertical narrative short film. The protagonist is a young woman in a red trench coat searching for her lost puppy at a rainy night train station. The 8 panels progress left-to-right, top-to-bottom showing discovering a clue, chasing, and reunion. Realistic cinematic style, cold blue rainy night, warm yellow platform lights, clear composition, consistent character appearance and outfit. No text, subtitles, logos, or watermarks."

npm run dream-video -- storyboard set img-1
npm run dream-video -- run --shot img-1

# Present the generated storyboard to the user for review; keyframe generation unlocks after confirmation
npm run dream-video -- storyboard confirm img-1
```

Create a scene:

```bash
npm run dream-video -- scene add \
  --name "Opening" \
  --panels 1-4 \
  --provider dreamina \
  --video-provider dreamina \
  --duration 6
```

After generating the three keyframes, review the suggested duration and full invocation settings:

```bash
npm run dream-video -- run --shot img-2
npm run dream-video -- run --shot img-3
npm run dream-video -- run --shot img-4
npm run dream-video -- video review vid-1

# Confirm video settings (and optionally adjust to the recommended duration); confirmation binds to the current prompt, reference frames, model, and resolution
npm run dream-video -- video confirm vid-1 --duration 10
npm run dream-video -- run --shot vid-1
```

Unconfirmed downstream stages are skipped by the runner; `--force` does not bypass human confirmation gates. Any change to the storyboard, keyframes, video prompt, provider, duration, model, or resolution automatically invalidates prior confirmations.

Generation order:

1. Storyboard
2. Scene first / middle / last frames
3. Seedance video

You can click **Generate / Animate** per shot in the UI, or target a specific shot via CLI:

```bash
npm run dream-video -- run --shot vid-1
```

Generation consumes provider credits. Always inspect prompts, reference images, and target shots before running rather than blindly executing all pending tasks.

## Common Commands

| Command | Purpose |
|---|---|
| `dream-video init [name]` | Create `canvas/project.json` |
| `dream-video storyboard set <id>` | Set the primary storyboard |
| `dream-video storyboard confirm [id]` | Confirm a generated storyboard and unlock keyframes |
| `dream-video scene add ...` | Create three keyframes and one video node |
| `dream-video video review <id>` | Show reference frames, prompt, model, resolution, duration, and recommendation |
| `dream-video video confirm <id>` | Confirm video settings and unlock generation for that video |
| `dream-video add image ...` | Add a standalone image node |
| `dream-video add video ...` | Add a standalone video node |
| `dream-video set <id> --prompt ...` | Update prompt and mark node as pending |
| `dream-video run [--shot id]` | Generate all confirmed or specified shots |
| `dream-video status` | Inspect project and generation status |
| `dream-video serve --no-open` | Start the local browser review canvas |

## Dreamina Configuration

Default environment variables:

| Variable | Default | Description |
|---|---|---|
| `CANVAS_DREAMINA_BIN` | `dreamina` | Path to the Dreamina CLI binary |
| `CANVAS_DREAMINA_IMAGE_MODEL` | `5.0` | Image model for storyboards and keyframes |
| `CANVAS_DREAMINA_IMAGE_RESOLUTION` | `2k` | Image output resolution |
| `CANVAS_DREAMINA_MODEL` | `seedance2.5` | Video generation model |
| `CANVAS_DREAMINA_RESOLUTION` | `720p` | Video output resolution |
| `CANVAS_DREAMINA_POLL_SECONDS` | `900` | Maximum polling timeout in seconds |

You can place overrides in `.env.local` at the project root:

```dotenv
CANVAS_DREAMINA_IMAGE_MODEL=5.0
CANVAS_DREAMINA_IMAGE_RESOLUTION=2k
CANVAS_DREAMINA_MODEL=seedance2.5
CANVAS_DREAMINA_RESOLUTION=720p
CANVAS_DREAMINA_POLL_SECONDS=900
```

Never commit credentials, tokens, `.env`, or `.env.local`.

## Project Files

```text
canvas/
├── project.json     # Prompts, scenes, dependencies, and status
└── assets/          # Generated images and videos
```

`canvas/` is git-ignored by default. Adjust ignore rules for your workflow if needed, but avoid publishing real-person reference photos or unlicensed media.

## Development & Verification

```bash
npm test
npm run typecheck
```

Tests do not invoke external models or consume Dreamina credits.

## Current Limitations

- Single scenes are currently limited to 6 or 10 seconds in the canvas.
- Seedance 2.5 outputs up to 720p in the current CLI.
- All reference keyframes must finish generating before video generation starts.
- Storyboards and video settings enforce human confirmation gates; batch runs will not cross unconfirmed gates.
- One video represents one continuous scene. Storyboards with more than 3 narrative panels should be split across multiple scenes rather than compressed into a single 6- or 10-second clip.
- Multi-scene final cuts still require an external video editor for stitching, music, and subtitles.

## License & Acknowledgements

Built upon [AsadMoulviDev/reel-video](https://github.com/AsadMoulviDev/reel-video) under the MIT License. Original copyright notice and license terms are preserved in [LICENSE](LICENSE).

Dreamina, Seedance, Codex, and Grok are products or trademarks of their respective owners; this project is not officially affiliated with those platforms.
