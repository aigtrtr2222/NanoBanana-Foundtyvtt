# NanoBanana Map Editor for FoundryVTT v13

> **나노바나나2 AI를 이용한 FoundryVTT v13 맵 편집 모듈**  
> A FoundryVTT v13 module that lets the GM drag-select any region of a scene, edit it using the NanoBanana2 AI image-editing API, and automatically place the result as a tile on the map.

---

## 원리 / How it works

```
맵 드래그 캡처  →  편집 프롬프트 입력  →  NanoBanana2 API 호출  →  결과 이미지를 타일로 배치
Drag-capture  →  Enter editing prompt  →  Call NanoBanana2 API  →  Place result as a map tile
```

1. **드래그 캡처 / Drag capture** – GM activates the *"캡처 & 편집 (NanoBanana)"* tool in the **Tiles** scene control group (or presses **Alt+M**), then drags a rectangle over any part of the scene.
2. **프롬프트 / Prompt** – A dialog appears with a thumbnail of the selected area. The GM types a text prompt describing the desired change.
3. **AI 편집 / AI edit** – The captured PNG and the prompt are sent to the NanoBanana2 REST API (`POST <apiUrl>/edit`).
4. **타일 배치 / Tile placement** – The returned image is uploaded to the FoundryVTT data folder and placed as a **Tile** at the exact same scene position and size, making the map appear edited.

---

## 설치 / Installation

### 방법 1 – Manifest URL

In FoundryVTT → **Add-on Modules → Install Module**, paste the manifest URL:

```
https://raw.githubusercontent.com/aigtrtr2222/NanoBanana-Foundtyvtt/main/module.json
```

### 방법 2 – 수동 / Manual

1. Download or clone this repository.
2. Copy the entire folder into `<foundrydata>/Data/modules/nanobanana-map-editor/`.
3. Restart FoundryVTT and enable the module in your world.

---

## 설정 / Configuration

Open **Game Settings → Configure Settings → Module Settings → NanoBanana Map Editor**.

| Setting | Default | Description |
|---------|---------|-------------|
| **NanoBanana2 API URL** | `http://localhost:7860` | Base URL of your NanoBanana2 server. The module sends requests to `<url>/edit`. |
| **NanoBanana2 API Key** | *(empty)* | Optional Bearer token. Leave blank if the server does not require authentication. |
| **Upload Folder** | `nanobanana-edits` | Sub-folder inside `<foundrydata>/Data/` where edited images are saved. |

---

## NanoBanana2 API 규격 / API contract

**Request** – `POST <apiUrl>/edit`

```json
{
  "image":  "<base64-encoded PNG, no data-URL prefix>",
  "prompt": "사용자가 입력한 프롬프트"
}
```

Header: `Authorization: Bearer <apiKey>` (if a key is configured).

**Response** (any of the following fields is accepted)

```json
{ "result":           "<base64 PNG or full data-URL>" }
{ "image":            "<base64 PNG or full data-URL>" }
{ "output":           "<base64 PNG or full data-URL>" }
{ "generated_image":  "<base64 PNG or full data-URL>" }
```

---

## 단축키 / Keybinding

| Key | Action |
|-----|--------|
| **Alt+M** | Toggle NanoBanana capture mode on/off |

The keybinding can be changed in **Configure Controls**.

---

## 호환성 / Compatibility

| FoundryVTT | Status |
|------------|--------|
| v13        | ✅ Verified |
| v12        | ⚠️ May work (untested) |
| v11 and below | ❌ Not supported |

---

## 파일 구조 / File structure

```
nanobanana-map-editor/
├── module.json             ← FVTT module manifest
├── scripts/
│   ├── main.mjs            ← Entry point: settings, hooks, workflow
│   ├── capture.mjs         ← DOM overlay drag-select + PIXI region capture
│   ├── api.mjs             ← NanoBanana2 REST API client
│   └── tile-placer.mjs     ← Upload image & create TileDocument
├── styles/
│   └── nanobanana.css      ← Selection overlay + dialog styles
└── lang/
    ├── en.json             ← English localization
    └── ko.json             ← Korean localization
```

---

## 라이선스 / License

MIT
