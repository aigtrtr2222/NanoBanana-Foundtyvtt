/**
 * NanoBanana Map Editor - Canvas Region Capture
 * Captures a rectangular region of the canvas as a base64-encoded image.
 */

/**
 * Capture a rectangular region of the canvas as a base64 PNG string.
 * Uses PIXI.js renderer to extract the region from the canvas stage.
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

  // Create a temporary render texture at the desired size
  const renderTexture = PIXI.RenderTexture.create({
    width: rect.width,
    height: rect.height,
    resolution: 1,
  });

  // Save the original transform of the stage
  const stage = canvas.stage;
  const originalTransform = {
    x: stage.position.x,
    y: stage.position.y,
    scaleX: stage.scale.x,
    scaleY: stage.scale.y,
  };

  // Move the stage so the target rect is at origin, with scale 1:1
  stage.position.set(-rect.x, -rect.y);
  stage.scale.set(1, 1);

  // Render the stage to our texture
  renderer.render(stage, { renderTexture });

  // Restore the original transform
  stage.position.set(originalTransform.x, originalTransform.y);
  stage.scale.set(originalTransform.scaleX, originalTransform.scaleY);

  // Extract pixels from the render texture
  const extractedCanvas = renderer.extract.canvas(renderTexture);

  // Convert to base64
  const dataUrl = extractedCanvas.toDataURL("image/png");
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");

  // Clean up
  renderTexture.destroy(true);

  return base64;
}
