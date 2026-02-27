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

## Installation

### Manual Installation

1. Download or clone this repository into your Foundry VTT `Data/modules/` directory:
   ```
   Data/modules/nanobanana-map-editor/
   ```
2. Restart Foundry VTT or refresh the module list.
3. Enable **NanoBanana Map Editor** in your world's module settings.

### Manifest URL

Use this URL in Foundry VTT's "Install Module" dialog:
```
https://github.com/aigtrtr2222/NanoBanana-Foundtyvtt/releases/latest/download/module.json
```

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
└── README.md
```

## API Compatibility

This module communicates with the standard **Stable Diffusion WebUI API** (`/sdapi/v1/img2img`). It is compatible with:

- [AUTOMATIC1111/stable-diffusion-webui](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
- [NanoBanana2](https://github.com/search?q=nanobanana2) or any fork using the same API
- Any backend implementing the SD WebUI API specification

## License

MIT