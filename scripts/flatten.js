/**
 * NanoBanana Map Editor - Flatten Tiles
 * Captures the entire map (including tiles), replaces the scene background
 * with the captured image, and removes all tiles.
 */

import { captureFullScene } from "./capture.js";

const MODULE_ID = "nanobanana-map-editor";

/**
 * Flatten all tiles into the scene background image.
 * 1. Captures the full scene canvas (background + all visible tiles).
 * 2. Uploads the captured image to the server.
 * 3. Updates the scene background to the captured image.
 * 4. Deletes all tiles from the scene.
 *
 * @returns {Promise<void>}
 */
export async function flattenTiles() {
  const scene = canvas.scene;
  if (!scene) {
    ui.notifications.error(game.i18n.localize("NANOBANANA.ErrorNoScene"));
    return;
  }

  const tiles = scene.tiles.contents;
  if (!tiles.length) {
    ui.notifications.warn(game.i18n.localize("NANOBANANA.FlattenNoTiles"));
    return;
  }

  // Confirm before proceeding
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("NANOBANANA.FlattenTitle") },
    content: `<p>${game.i18n.format("NANOBANANA.FlattenConfirm", { count: tiles.length })}</p>`,
    yes: { label: game.i18n.localize("NANOBANANA.FlattenExecute"), icon: "fas fa-layer-group" },
    no: { label: game.i18n.localize("NANOBANANA.DialogCancel"), icon: "fas fa-times" },
  });
  if (!confirmed) return;

  try {
    ui.notifications.info(game.i18n.localize("NANOBANANA.FlattenCapturing"));

    // 1. Capture the full scene
    const imageBase64 = await captureFullScene();

    // 2. Upload the captured image
    const byteString = atob(imageBase64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: "image/png" });
    const timestamp = Date.now();
    const filename = `nanobanana-flatten-${timestamp}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    const uploadDir = MODULE_ID;
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;

    try {
      await FP.createDirectory("data", uploadDir);
    } catch {
      // Directory may already exist
    }

    const uploadResponse = await FP.upload("data", uploadDir, file);
    if (!uploadResponse?.path) {
      throw new Error("Failed to upload flattened image to server.");
    }

    // 3. Replace scene background
    await scene.update({ "background.src": uploadResponse.path });

    // 4. Delete all tiles
    const tileIds = tiles.map((t) => t.id);
    await scene.deleteEmbeddedDocuments("Tile", tileIds);

    ui.notifications.info(game.i18n.localize("NANOBANANA.FlattenSuccess"));
  } catch (err) {
    console.error(`${MODULE_ID} | Flatten error:`, err);
    ui.notifications.error(
      game.i18n.format("NANOBANANA.FlattenFailed", { error: err.message })
    );
  }
}
