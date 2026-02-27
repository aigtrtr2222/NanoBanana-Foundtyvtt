/**
 * NanoBanana Map Editor - Main Module Entry Point
 * A Foundry VTT v13 module that allows editing maps using NanoBanana2 AI.
 *
 * Workflow:
 * 1. User activates the NanoBanana tool from the scene controls
 * 2. User drags to select a rectangular region on the map
 * 3. A dialog appears with the captured region preview and a prompt input
 * 4. The captured image and prompt are sent to NanoBanana2 (img2img API)
 * 5. The AI-generated result is placed as a tile on the map
 */

import { registerSettings, getSetting } from "./settings.js";
import { captureCanvasRegion } from "./capture.js";
import { sendImg2Img } from "./api.js";
import { showPromptDialog } from "./dialog.js";
import { placeTile } from "./tile.js";

const MODULE_ID = "nanobanana-map-editor";

/* ------------------------------------------------------------------ */
/*  Selection Tool Layer                                               */
/* ------------------------------------------------------------------ */

/**
 * A PIXI container used as an interaction layer for drag-selection.
 * Renders a dashed rectangle while the user drags on the canvas.
 */
class NanoBananaSelectionLayer {
  constructor() {
    this._active = false;
    this._startPoint = null;
    this._graphics = null;
    this._container = null;
  }

  /** Activate the selection layer on the canvas */
  activate() {
    if (this._active) return;
    this._active = true;

    // Create a PIXI container for the selection rectangle
    this._container = new PIXI.Container();
    this._container.eventMode = "static";
    // Large hit area covers the entire possible canvas area for pointer events
    this._container.hitArea = new PIXI.Rectangle(
      -1e7, -1e7, 2e7, 2e7
    );
    this._container.cursor = "crosshair";
    this._graphics = new PIXI.Graphics();
    this._container.addChild(this._graphics);

    // Add to canvas above the tokens layer
    canvas.stage.addChild(this._container);

    // Bind event handlers
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);

    this._container.on("pointerdown", this._onPointerDown);
    this._container.on("pointermove", this._onPointerMove);
    this._container.on("pointerup", this._onPointerUp);
    this._container.on("pointerupoutside", this._onPointerUp);
  }

  /** Deactivate and remove the selection layer */
  deactivate() {
    if (!this._active) return;
    this._active = false;

    if (this._container) {
      this._container.off("pointerdown", this._onPointerDown);
      this._container.off("pointermove", this._onPointerMove);
      this._container.off("pointerup", this._onPointerUp);
      this._container.off("pointerupoutside", this._onPointerUp);
      canvas.stage.removeChild(this._container);
      this._container.destroy({ children: true });
      this._container = null;
      this._graphics = null;
    }
    this._startPoint = null;
  }

  _handlePointerDown(event) {
    const pos = event.getLocalPosition(canvas.stage);
    this._startPoint = { x: pos.x, y: pos.y };
    this._graphics.clear();
  }

  _handlePointerMove(event) {
    if (!this._startPoint) return;
    const pos = event.getLocalPosition(canvas.stage);
    this._drawRect(this._startPoint, pos);
  }

  async _handlePointerUp(event) {
    if (!this._startPoint) return;
    const pos = event.getLocalPosition(canvas.stage);
    const rect = this._normalizeRect(this._startPoint, pos);
    this._startPoint = null;
    this._graphics.clear();

    // Minimum selection size check
    if (rect.width < 10 || rect.height < 10) return;

    // Deactivate selection before processing
    this.deactivate();

    // Process the selected region
    await processSelection(rect);
  }

  _drawRect(start, end) {
    const g = this._graphics;
    g.clear();
    g.lineStyle(2, 0xff6600, 1);
    g.beginFill(0xff6600, 0.15);
    const r = this._normalizeRect(start, end);
    g.drawRect(r.x, r.y, r.width, r.height);
    g.endFill();
  }

  _normalizeRect(start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    return { x, y, width, height };
  }
}

// Singleton instance
let selectionLayer = null;

/* ------------------------------------------------------------------ */
/*  Core Workflow                                                       */
/* ------------------------------------------------------------------ */

/**
 * Process a selected region: capture, prompt, generate, and place tile.
 * @param {object} rect - The selected rectangle in scene coordinates
 */
async function processSelection(rect) {
  try {
    // 1. Check API configuration
    const apiUrl = getSetting("apiUrl");
    if (!apiUrl) {
      ui.notifications.error(game.i18n.localize("NANOBANANA.ErrorNoApi"));
      return;
    }

    // 2. Check active scene
    if (!canvas.scene) {
      ui.notifications.error(game.i18n.localize("NANOBANANA.ErrorNoScene"));
      return;
    }

    // 3. Capture the region
    let capturedBase64;
    try {
      capturedBase64 = await captureCanvasRegion(rect);
    } catch (err) {
      console.error(`${MODULE_ID} | Capture error:`, err);
      ui.notifications.error(
        game.i18n.localize("NANOBANANA.ErrorCaptureFailed")
      );
      return;
    }

    // 4. Show prompt dialog
    const dialogResult = await showPromptDialog(capturedBase64, rect);
    if (!dialogResult) return; // User cancelled

    // 5. Send to NanoBanana2 API
    ui.notifications.info(game.i18n.localize("NANOBANANA.Generating"));

    const resultBase64 = await sendImg2Img(capturedBase64, {
      prompt: dialogResult.prompt,
      negativePrompt: dialogResult.negativePrompt,
      denoisingStrength: dialogResult.denoisingStrength,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });

    // 6. Place as tile
    await placeTile(resultBase64, rect);
    ui.notifications.info(game.i18n.localize("NANOBANANA.Success"));
  } catch (err) {
    console.error(`${MODULE_ID} | Error:`, err);
    ui.notifications.error(
      game.i18n.format("NANOBANANA.ErrorApiFailed", { error: err.message })
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Hook Registration                                                   */
/* ------------------------------------------------------------------ */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing NanoBanana Map Editor`);
  registerSettings();
});

Hooks.on("getSceneControlButtons", (controls) => {
  const tileControls = controls.find((c) => c.name === "tiles");
  if (!tileControls) return;

  tileControls.tools.push({
    name: "nanobanana-capture",
    title: game.i18n.localize("NANOBANANA.ToolTitle"),
    icon: "fas fa-wand-magic-sparkles",
    button: true,
    onClick: () => {
      if (selectionLayer?._active) {
        selectionLayer.deactivate();
        selectionLayer = null;
        return;
      }
      selectionLayer = new NanoBananaSelectionLayer();
      selectionLayer.activate();
      ui.notifications.info(
        game.i18n.localize("NANOBANANA.ToolHint")
      );
    },
  });
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | NanoBanana Map Editor is ready`);
});
