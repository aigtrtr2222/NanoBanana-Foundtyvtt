# NanoBanana Map Editor for Foundry VTT v13

A Foundry VTT v13 module that lets you edit maps using **NanoBanana2** (Stable Diffusion WebUI) AI image generation. Capture a region of the map, enter a prompt, and the AI-modified image is placed as a tile—making it look like the map itself was edited.

## How It Works

1. **Select** – Activate the NanoBanana tool from the Tiles control bar, then drag to select a rectangular region on the map.
2. **Prompt** – A dialog appears showing a preview of the captured area. Enter a text prompt describing how you want to modify the region.
3. **Generate** – The captured image and prompt are sent to your NanoBanana2 (Stable Diffusion WebUI) API via the `img2img` endpoint.
4. **Place** – The AI-generated result image is automatically uploaded and placed as a tile at the exact same position, visually modifying the map.

## Requirements

- **Foundry VTT v13** (minimum v13, verified v13.351)
- **NanoBanana2 / Stable Diffusion WebUI** running with `--api` flag enabled
  - e.g. `python launch.py --api`
  - Default API URL: `http://127.0.0.1:7860`

## Installation / 설치 방법

### Method 1: Manifest URL (Recommended / 권장)

In Foundry VTT, go to **Add-on Modules → Install Module**, paste this URL into the **Manifest URL** field at the bottom, and click **Install**:

Foundry VTT에서 **애드온 모듈 → 모듈 설치**로 이동하여 하단의 **Manifest URL** 필드에 아래 URL을 붙여넣고 **설치**를 클릭하세요:

```
https://github.com/aigtrtr2222/NanoBanana-Foundtyvtt/releases/latest/download/module.json
```

### Method 2: Direct Download / 직접 다운로드

1. Go to the [Releases page](https://github.com/aigtrtr2222/NanoBanana-Foundtyvtt/releases/latest) and download **module.zip**.

   [릴리스 페이지](https://github.com/aigtrtr2222/NanoBanana-Foundtyvtt/releases/latest)에서 **module.zip**을 다운로드하세요.

2. Extract it into your Foundry VTT data folder:

   압축을 풀어 Foundry VTT 데이터 폴더에 넣으세요:

   ```
   Data/modules/nanobanana-map-editor/
   ```
3. Restart Foundry VTT, then enable the module in your world settings.

   Foundry VTT를 재시작한 후, 월드 설정에서 모듈을 활성화하세요.

### Creating a Release / 릴리스 생성

To publish a new version, push a git tag:

새 버전을 배포하려면 git 태그를 푸시하세요:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Actions workflow will automatically create a release with the `module.json` and `module.zip` files.

GitHub Actions 워크플로우가 자동으로 `module.json`과 `module.zip` 파일이 포함된 릴리스를 생성합니다.

## Configuration

Go to **Settings → Module Settings → NanoBanana Map Editor**:

| Setting | Description | Default |
|---------|-------------|---------|
| **API URL** | Base URL of your NanoBanana2/SD WebUI API | `http://127.0.0.1:7860` |
| **Denoising Strength** | How much the image changes (0 = no change, 1 = full regeneration) | `0.75` |
| **Sampling Steps** | Number of diffusion steps | `20` |
| **CFG Scale** | How strongly the prompt guides generation | `7` |
| **Sampler** | Sampling method name | `Euler a` |
| **Negative Prompt** | Default negative prompt for all requests | `blurry, low quality, distorted, watermark, text` |

## Usage

1. Open a scene with a map background.
2. Switch to the **Tiles** control group in the left toolbar.
3. Click the **✨ NanoBanana Map Editor** button (wand icon).
4. **Drag** on the canvas to select the area you want to modify.
5. In the dialog that appears:
   - Enter your **prompt** (e.g. "add a river flowing through this area")
   - Optionally adjust the **negative prompt** and **denoising strength**
6. Click **Generate** and wait for the AI to process.
7. The result is placed as a tile on the map.

## Module Structure

```
nanobanana-map-editor/
├── module.json           # Module manifest
├── scripts/
│   ├── main.js           # Entry point, hooks, selection tool
│   ├── settings.js       # Module settings registration
│   ├── api.js            # NanoBanana2 API communication
│   ├── capture.js        # Canvas region capture
│   ├── dialog.js         # Prompt input dialog
│   └── tile.js           # Tile placement logic
├── styles/
│   └── nanobanana.css    # Module styles
├── lang/
│   ├── en.json           # English localization
│   └── ko.json           # Korean (한국어) localization
├── .github/workflows/
│   └── release.yml       # Auto-release on tag push
└── README.md
```

## API Compatibility

This module communicates with the standard **Stable Diffusion WebUI API** (`/sdapi/v1/img2img`). It is compatible with:

- [AUTOMATIC1111/stable-diffusion-webui](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
- [NanoBanana2](https://github.com/search?q=nanobanana2) or any fork using the same API
- Any backend implementing the SD WebUI API specification

## License

MIT