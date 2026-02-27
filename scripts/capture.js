/**
 * NanoBanana Map Editor - Canvas Region Capture
 * Captures a rectangular region of the canvas as a base64-encoded image.
 */

/**
 * Capture a rectangular region of the canvas as a base64 PNG string.
 * Uses canvas readback as the primary method (preserves FoundryVTT's full
 * rendering pipeline including background, lighting, and effects), with a
 * PIXI RenderTexture fallback for backends where canvas readback is
 * unavailable (e.g. WebGPU).
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

  // Compute the current stage transform so we can map scene coordinates to
  // screen-pixel coordinates on the rendered canvas.
  const scaleX = stage.scale.x;
  const scaleY = stage.scale.y;
  const offsetX = stage.position.x;
  const offsetY = stage.position.y;

  // Account for renderer resolution (e.g., high-DPI / Retina displays).
  const resolution = renderer.resolution ?? window.devicePixelRatio ?? 1;

  // Convert scene coordinates to canvas pixel coordinates
  const srcX = Math.round((rect.x * scaleX + offsetX) * resolution);
  const srcY = Math.round((rect.y * scaleY + offsetY) * resolution);
  const srcW = Math.round(rect.width * scaleX * resolution);
  const srcH = Math.round(rect.height * scaleY * resolution);

  // --- Primary method: canvas readback ---
  // Force a full render through FoundryVTT's normal pipeline so that all
  // layers (background, tokens, lighting, etc.) are composited correctly,
  // then crop the desired region from the canvas element.
  try {
    canvas.app.render();

    const view = renderer.view ?? renderer.canvas;
    if (view) {
      const offscreen = document.createElement("canvas");
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext("2d");
      ctx.drawImage(view, srcX, srcY, srcW, srcH, 0, 0, w, h);

      const dataUrl = offscreen.toDataURL("image/png");
      return dataUrl.replace(/^data:image\/png;base64,/, "");
    }
  } catch (err) {
    console.warn("nanobanana-map-editor | canvas readback failed, trying render texture approach", err);
  }

  // --- Fallback: render texture approach ---
  // Renders the stage container directly into an offscreen texture. This may
  // miss some FoundryVTT-specific compositing but works when the canvas
  // element is not readable.
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
    console.warn("nanobanana-map-editor | render texture capture also failed", err);
  }

  throw new Error("No capture method available");
}
