/**
 * NanoBanana Map Editor - Canvas Region Capture
 * Captures a rectangular region of the canvas as a base64-encoded image.
 *
 * Uses the renderer-resize approach: temporarily resizes the renderer to
 * match the capture region, pans to center on the selected area at 1:1
 * scale, then renders individual canvas layers into a RenderTexture.
 * This avoids culling issues and correctly captures all visible elements.
 */

/**
 * Capture the full scene canvas as a base64 PNG string.
 * Delegates to captureCanvasRegion using the full scene dimensions.
 *
 * @returns {Promise<string>} Base64-encoded PNG image (without data URI prefix)
 */
export async function captureFullScene() {
  const d = canvas.dimensions;
  return captureCanvasRegion({
    x: d.sceneX,
    y: d.sceneY,
    width: d.sceneWidth,
    height: d.sceneHeight,
  });
}

/**
 * Capture a rectangular region of the canvas as a base64 PNG string.
 * Temporarily reconfigures the renderer to avoid culling, renders each
 * visible layer into an offscreen RenderTexture, then restores the
 * original viewport.
 *
 * @param {object} rect - The rectangle to capture in scene coordinates
 * @param {number} rect.x - Left edge in scene coordinates
 * @param {number} rect.y - Top edge in scene coordinates
 * @param {number} rect.width - Width in scene coordinates
 * @param {number} rect.height - Height in scene coordinates
 * @returns {Promise<string>} Base64-encoded PNG image (without data URI prefix)
 */
export async function captureCanvasRegion(rect) {
  const renderer = canvas.app.renderer;

  const w = Math.round(rect.width);
  const h = Math.round(rect.height);

  // Save original state for restoration
  const oldView = { ...canvas.scene._viewPosition };
  const oldRes = renderer.resolution;

  // Temporarily resize the renderer to the capture region so that the
  // entire area is rendered without viewport culling.
  renderer.resolution = 1;
  renderer.resize(w, h);
  canvas.screenDimensions[0] = w;
  canvas.screenDimensions[1] = h;

  // Center the view on the selected region at 1:1 scale
  const centerX = rect.x + w / 2;
  const centerY = rect.y + h / 2;
  canvas.stage.position.set(w / 2, h / 2);
  canvas.pan({ x: centerX, y: centerY, scale: 1 });

  // Force a full transform update so every display object has the correct
  // world transform before we render individual layers.
  const cacheParent = canvas.stage.enableTempParent();
  canvas.stage.updateTransform();
  canvas.stage.disableTempParent(cacheParent);

  const rt = PIXI.RenderTexture.create({ width: w, height: h });

  try {
    // Render hidden group first – prepares masks for LOS / visibility cones
    renderer.render(canvas.hidden, { renderTexture: rt, skipUpdateTransform: true, clear: false });

    // Background
    renderer.render(canvas.primary.background, { renderTexture: rt, skipUpdateTransform: true });

    // Visible tiles
    for (const tile of canvas.tiles.placeables.filter(x => !x.document.hidden)) {
      if (tile.mesh) renderer.render(tile.mesh, { renderTexture: rt, skipUpdateTransform: true, clear: false });
    }

    // Scene drawings (non-interface)
    for (const drawing of canvas.drawings.placeables.filter(x => !x.document.hidden && !x.document.interface)) {
      if (drawing.shape) renderer.render(drawing.shape, { renderTexture: rt, skipUpdateTransform: true, clear: false });
    }

    // Fog / Line of Sight / visibility
    renderer.render(canvas.visibility, { renderTexture: rt, skipUpdateTransform: true, clear: false });

    // Grid
    if (canvas.interface?.grid?.mesh) {
      renderer.render(canvas.interface.grid.mesh, { renderTexture: rt, skipUpdateTransform: true, clear: false });
    }

    // Visible tokens
    for (const token of canvas.tokens.placeables.filter(x => !x.document.hidden)) {
      if (token.mesh) renderer.render(token.mesh, { renderTexture: rt, skipUpdateTransform: true, clear: false });
    }

    // Informational drawings
    for (const drawing of canvas.drawings.placeables.filter(x => !x.document.hidden && x.document.interface)) {
      if (drawing.shape) renderer.render(drawing.shape, { renderTexture: rt, skipUpdateTransform: true, clear: false });
    }

    // Extract the rendered image as base64 PNG
    const sprite = PIXI.Sprite.from(rt);
    try {
      const result = await ImageHelper.createThumbnail(sprite, {
        width: w,
        height: h,
        format: "image/png",
        quality: 1.0,
      });
      return result.thumb.replace(/^data:image\/png;base64,/, "");
    } finally {
      sprite.destroy();
    }
  } catch (error) {
    console.error("nanobanana-map-editor | Capture error:", error);
    throw new Error("Failed to capture canvas region");
  } finally {
    // Always restore the original renderer state
    rt.destroy();
    renderer.resolution = oldRes;
    canvas._onResize();
    canvas.pan(oldView);
  }
}
