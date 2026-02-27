/**
 * NanoBanana Map Editor - Canvas Region Capture
 * Captures a rectangular region of the canvas as a base64-encoded image.
 */

/**
 * Capture a rectangular region of the canvas as a base64 PNG string.
 * Uses the renderer's visible canvas element and redraws the desired region
 * onto an offscreen canvas, which is compatible with all PIXI versions used
 * by Foundry VTT v13.
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
  const stage = canvas.stage;

  const w = Math.round(rect.width);
  const h = Math.round(rect.height);

  // --- Primary method: draw from the renderer's visible canvas element ---
  const view = renderer.view ?? renderer.canvas;
  if (view) {
    try {
      const scaleX = stage.scale.x;
      const scaleY = stage.scale.y;
      const offsetX = stage.position.x;
      const offsetY = stage.position.y;

      // Convert scene coordinates to screen (pixel) coordinates
      const srcX = Math.round(rect.x * scaleX + offsetX);
      const srcY = Math.round(rect.y * scaleY + offsetY);
      const srcW = Math.round(rect.width * scaleX);
      const srcH = Math.round(rect.height * scaleY);

      const offscreen = document.createElement("canvas");
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext("2d");
      ctx.drawImage(view, srcX, srcY, srcW, srcH, 0, 0, w, h);

      // Verify the canvas is not blank
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      const hasContent = pixel[0] + pixel[1] + pixel[2] + pixel[3] > 0;
      if (hasContent) {
        const dataUrl = offscreen.toDataURL("image/png");
        return dataUrl.replace(/^data:image\/png;base64,/, "");
      }
    } catch (err) {
      console.warn("nanobanana-map-editor | view capture failed, trying render texture", err);
    }
  }

  // --- Fallback: render texture approach ---
  const renderTexture = PIXI.RenderTexture.create({
    width: w,
    height: h,
    resolution: 1,
  });

  const origX = stage.position.x;
  const origY = stage.position.y;
  const origScaleX = stage.scale.x;
  const origScaleY = stage.scale.y;

  stage.position.set(-rect.x, -rect.y);
  stage.scale.set(1, 1);

  try {
    // PIXI v8 style (Foundry VTT v13+)
    renderer.render({ container: stage, target: renderTexture });
  } catch {
    // PIXI v7 style
    renderer.render(stage, { renderTexture });
  }

  stage.position.set(origX, origY);
  stage.scale.set(origScaleX, origScaleY);

  let dataUrl;
  try {
    const result = renderer.extract.canvas(renderTexture);
    const c = (result instanceof Promise) ? await result : result;
    dataUrl = c.toDataURL("image/png");
  } catch {
    dataUrl = await renderer.extract.base64(renderTexture, "image/png");
  }

  renderTexture.destroy(true);
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}
