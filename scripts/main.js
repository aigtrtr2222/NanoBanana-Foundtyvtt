/**
 * NanoBanana Map Editor - Main Module Entry Point
 * A Foundry VTT v13 module that allows editing maps using NanoBanana (Google Generative AI).
 *
 * Workflow:
 * 1. User activates the NanoBanana tool from the scene controls
 * 2. User drags to select a rectangular region on the map
 * 3. A dialog appears with the captured region preview, model selection, and a prompt input
 * 4. The captured image and prompt are sent to the Google Generative AI API
 * 5. The AI-generated result is placed as a tile on the map
 */

import { registerSettings, getSetting } from "./settings.js";
import { captureCanvasRegion } from "./capture.js";
import { sendImg2Img } from "./api.js";
import { showPromptDialog } from "./dialog.js";
import { placeTile } from "./tile.js";
import { flattenTiles } from "./flatten.js";
import {
  showPortraitEditDialog,
  showTokenEditDialog,
  showTokenGenerateDialog,
} from "./portrait-dialog.js";

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
      // Immediately disable event processing to prevent PixiJS from dispatching
      // further events (pointerout, pointermove) on this container.
      this._container.eventMode = "none";
      this._container.interactiveChildren = false;

      this._container.off("pointerdown", this._onPointerDown);
      this._container.off("pointermove", this._onPointerMove);
      this._container.off("pointerup", this._onPointerUp);
      this._container.off("pointerupoutside", this._onPointerUp);

      // Hide the container visually while it remains in the display tree.
      this._container.visible = false;

      // Purge this container from the PixiJS EventBoundary's internal
      // "over targets" tracking. Without this, the EventBoundary would
      // try to dispatch a pointerout event to the container after it has
      // been removed from the stage, triggering "Cannot find propagation
      // path to disconnected target".
      const containerRef = this._container;
      _purgeFromEventBoundary(containerRef);

      // Temporarily suppress the specific PixiJS error as a safety net in
      // case the EventBoundary internal API differs across PixiJS versions.
      const removeHandler = _suppressDisconnectedTargetError();

      // Defer removal from stage to avoid errors when deactivate is called
      // during an event handler (e.g. pointerup). PixiJS EventBoundary may
      // still reference the container for the remainder of the current
      // event dispatch cycle.
      requestAnimationFrame(() => {
        if (containerRef.parent) {
          containerRef.parent.removeChild(containerRef);
        }
        containerRef.destroy({ children: true });
        // Keep the error handler active briefly after removal so it covers
        // any pointer events that fire before PixiJS fully clears tracking.
        setTimeout(removeHandler, 2000);
      });

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

/**
 * Remove a display object from the PixiJS EventBoundary's internal "over
 * targets" tracking table.  This prevents "Cannot find propagation path to
 * disconnected target" errors when the object is later removed from the stage.
 *
 * @param {PIXI.Container} target - The display object to purge
 */
function _purgeFromEventBoundary(target) {
  try {
    const boundary = canvas.app?.renderer?.events?.rootBoundary;
    if (!boundary) return;

    // PixiJS EventBoundary tracks which targets each pointer is "over"
    // in the `overTargets` property (Record<number, Container[]>).
    const overTargets = boundary.overTargets;
    if (!overTargets || typeof overTargets !== "object") return;

    for (const key of Object.keys(overTargets)) {
      const targets = overTargets[key];
      if (Array.isArray(targets)) {
        overTargets[key] = targets.filter((t) => t !== target);
      }
    }
  } catch {
    // Best-effort cleanup; ignore errors from unexpected PixiJS internals.
  }
}

/**
 * Install a temporary window-level error handler that suppresses the PixiJS
 * EventBoundary "disconnected target" error.  Returns a function that removes
 * the handler when called.
 *
 * @returns {function} Cleanup function to remove the handler
 */
function _suppressDisconnectedTargetError() {
  const handler = (event) => {
    if (
      event.error?.message?.includes(
        "Cannot find propagation path to disconnected target"
      )
    ) {
      console.debug("nanobanana-map-editor | Suppressed PixiJS disconnected target error during cleanup");
      event.preventDefault();
    }
  };
  window.addEventListener("error", handler);
  return () => window.removeEventListener("error", handler);
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
    const apiKey = getSetting("apiKey");
    if (!apiKey) {
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

    // 5. Send to Google Generative AI API
    ui.notifications.info(game.i18n.localize("NANOBANANA.Generating"));

    const resultBase64 = await sendImg2Img(capturedBase64, {
      prompt: dialogResult.prompt,
      model: dialogResult.model,
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
  // In Foundry VTT v13, controls may be an object keyed by name instead of an array
  const controlList = Array.isArray(controls) ? controls : Object.values(controls);
  const tileControls = controlList.find((c) => c.name === "tiles");
  if (!tileControls) return;

  const nanobananaTool = {
    name: "nanobanana-capture",
    title: game.i18n.localize("NANOBANANA.ToolTitle"),
    icon: "fas fa-wand-magic-sparkles",
    visible: true,
    toggle: false,
    button: true,
    onChange: () => {
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
  };

  const flattenTool = {
    name: "nanobanana-flatten",
    title: game.i18n.localize("NANOBANANA.FlattenTitle"),
    icon: "fas fa-layer-group",
    visible: true,
    toggle: false,
    button: true,
    onChange: () => {
      flattenTiles();
    },
  };

  // In Foundry VTT v13, tools may be an object keyed by name instead of an array
  if (Array.isArray(tileControls.tools)) {
    tileControls.tools.push(nanobananaTool);
    tileControls.tools.push(flattenTool);
  } else {
    tileControls.tools[nanobananaTool.name] = nanobananaTool;
    tileControls.tools[flattenTool.name] = flattenTool;
  }
});

/* ------------------------------------------------------------------ */
/*  Character Sheet – Portrait/Token Buttons                           */
/* ------------------------------------------------------------------ */

/**
 * Inject NanoBanana portrait/token editing buttons above the character
 * sheet tabs.
 */
function _injectPortraitButtons(sheet, html) {
  const actor = sheet.actor ?? sheet.document;
  if (!actor || !(actor instanceof Actor)) return;

  const element = html instanceof HTMLElement ? html : html?.[0] ?? html;
  if (!element?.querySelector) return;

  // Prevent double-injection
  if (element.querySelector(".nanobanana-portrait-buttons")) return;

  // Find tab navigation – try several selectors used by common systems (v1 & v2)
  const tabs =
    element.querySelector("nav.sheet-tabs") ??
    element.querySelector(".sheet-tabs") ??
    element.querySelector("nav.sheet-navigation") ??
    element.querySelector(".tabs[data-group]") ??
    element.querySelector(".tabs");

  // Build button bar
  const bar = document.createElement("div");
  bar.className = "nanobanana-portrait-buttons";
  bar.innerHTML = `
    <button type="button" class="nanobanana-portrait-btn" data-action="edit-portrait" title="${game.i18n.localize("NANOBANANA.PortraitEditTitle")}">
      <i class="fas fa-wand-magic-sparkles"></i> ${game.i18n.localize("NANOBANANA.PortraitEditBtn")}
    </button>
    <button type="button" class="nanobanana-portrait-btn" data-action="edit-token" title="${game.i18n.localize("NANOBANANA.TokenEditTitle")}">
      <i class="fas fa-wand-magic-sparkles"></i> ${game.i18n.localize("NANOBANANA.TokenEditBtn")}
    </button>
    <button type="button" class="nanobanana-portrait-btn" data-action="generate-token" title="${game.i18n.localize("NANOBANANA.TokenGenerateTitle")}">
      <i class="fas fa-magic"></i> ${game.i18n.localize("NANOBANANA.TokenGenerateBtn")}
    </button>
  `;

  if (tabs) {
    tabs.parentNode.insertBefore(bar, tabs);
  } else {
    // Fallback: insert at the top of the sheet body or header for v2 sheets
    // that may not use a traditional tab navigation structure
    const body =
      element.querySelector(".sheet-body") ??
      element.querySelector(".window-content");
    if (body) {
      body.prepend(bar);
    } else {
      return;
    }
  }

  // Wire up click handlers
  bar.querySelector('[data-action="edit-portrait"]').addEventListener("click", (ev) => {
    ev.preventDefault();
    showPortraitEditDialog(actor);
  });
  bar.querySelector('[data-action="edit-token"]').addEventListener("click", (ev) => {
    ev.preventDefault();
    showTokenEditDialog(actor);
  });
  bar.querySelector('[data-action="generate-token"]').addEventListener("click", (ev) => {
    ev.preventDefault();
    showTokenGenerateDialog(actor);
  });
}

// Inject buttons for both Application v1 and v2 actor sheets
Hooks.on("renderActorSheet", (sheet, html) => {
  _injectPortraitButtons(sheet, html);
});
Hooks.on("renderActorSheetV2", (sheet, html) => {
  _injectPortraitButtons(sheet, html);
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | NanoBanana Map Editor is ready`);
});
