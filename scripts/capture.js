/**
 * NanoBanana Map Editor - Canvas Region Capture
 * Captures a rectangular region of the canvas as a base64-encoded image.
 */

/**
 * Capture a rectangular region of the canvas as a base64 PNG string.
 * Uses PIXI RenderTexture as the primary method (reliable across WebGL and
 * WebGPU backends), with a canvas-element fallback for edge cases.
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

  // --- Primary method: render texture approach ---
  // This is the most reliable method across WebGL and WebGPU backends because
  // it renders to an offscreen texture using PIXI's own extract API, avoiding
  // issues with preserveDrawingBuffer and canvas buffer accessibility.
  try {
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
  } catch (err) {
    console.warn("nanobanana-map-editor | render texture capture failed, trying canvas extraction", err);
  }

  // --- Fallback: draw from the renderer's visible canvas element ---
  // Force a fresh render so the canvas element contains up-to-date pixel data.
  try {
    renderer.render({ container: stage });
  } catch {
    try { renderer.render(stage); } catch (e) { console.debug("nanobanana-map-editor | forced render failed", e); }
  }

  const view = renderer.view ?? renderer.canvas;
  if (view) {
    const scaleX = stage.scale.x;
    const scaleY = stage.scale.y;
    const offsetX = stage.position.x;
    const offsetY = stage.position.y;

    // Account for renderer resolution (e.g., high-DPI / Retina displays).
    // The canvas pixel buffer is scaled by the renderer's resolution factor,
    // so screen coordinates must be multiplied accordingly.
    const resolution = renderer.resolution ?? window.devicePixelRatio ?? 1;

    // Convert scene coordinates to canvas pixel coordinates
    const srcX = Math.round((rect.x * scaleX + offsetX) * resolution);
    const srcY = Math.round((rect.y * scaleY + offsetY) * resolution);
    const srcW = Math.round(rect.width * scaleX * resolution);
    const srcH = Math.round(rect.height * scaleY * resolution);

    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d");
    ctx.drawImage(view, srcX, srcY, srcW, srcH, 0, 0, w, h);

    const dataUrl = offscreen.toDataURL("image/png");
    return dataUrl.replace(/^data:image\/png;base64,/, "");
  }

  throw new Error("No capture method available");
}
