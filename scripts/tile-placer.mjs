/**
 * NanoBanana Map Editor – tile-placer.mjs
 *
 * Uploads the AI-edited image to the FoundryVTT data directory and creates
 * a TileDocument on the current scene at the originally captured position.
 */

/**
 * @param {string} imageDataUrl   Edited image as a data URL (data:image/png;base64,…)
 * @param {number} sceneX         Left edge of the tile in scene coordinates
 * @param {number} sceneY         Top  edge of the tile in scene coordinates
 * @param {number} sceneW         Width  of the tile in scene units
 * @param {number} sceneH         Height of the tile in scene units
 * @param {string} uploadFolder   Folder path inside the FoundryVTT data storage
 * @returns {Promise<TileDocument>}
 */
export async function placeEditedTile(imageDataUrl, sceneX, sceneY, sceneW, sceneH, uploadFolder) {
  // -------------------------------------------------------------------------
  // 1. Convert the data URL to a File object
  // -------------------------------------------------------------------------
  const res  = await fetch(imageDataUrl);
  const blob = await res.blob();
  const filename = `nanobanana_${Date.now()}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  // -------------------------------------------------------------------------
  // 2. Ensure the upload folder exists (silently ignore "already exists" error)
  // -------------------------------------------------------------------------
  try {
    await FilePicker.createDirectory('data', uploadFolder);
  } catch (_) {
    // The folder likely already exists – that's fine
  }

  // -------------------------------------------------------------------------
  // 3. Upload the file to the FoundryVTT data storage
  // -------------------------------------------------------------------------
  const uploadResult = await FilePicker.upload('data', uploadFolder, file, { notify: false });
  if (!uploadResult?.path) {
    throw new Error(game.i18n.localize('NANOBANANA.Errors.UploadFailed'));
  }

  // -------------------------------------------------------------------------
  // 4. Create a TileDocument on the current scene
  // -------------------------------------------------------------------------
  const tileData = {
    texture:   { src: uploadResult.path },
    x:         Math.round(sceneX),
    y:         Math.round(sceneY),
    width:     Math.round(sceneW),
    height:    Math.round(sceneH),
    hidden:    false,
    locked:    false,
    overhead:  false,
    elevation: 0,
    sort:      0,
    occlusion: { mode: 0, alpha: 0 },
  };

  return TileDocument.create(tileData, { parent: canvas.scene });
}
