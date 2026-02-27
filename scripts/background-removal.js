/**
 * NanoBanana Map Editor - Background Removal
 * Post-processing utility to remove white backgrounds from AI-generated images,
 * restoring transparency for tokens and portraits.
 *
 * Uses a flood-fill approach from the image edges to identify connected
 * white/near-white regions and make them transparent.
 */

/**
 * Remove white background from a base64-encoded PNG image.
 * Performs a flood-fill from all edge pixels, marking connected white/near-white
 * pixels as transparent. Interior white regions (e.g. white clothing) are preserved.
 *
 * @param {string} base64Image - Base64-encoded PNG image (without data URI prefix)
 * @param {number} [threshold=30] - Color distance threshold for white detection (0–441).
 *   The maximum possible distance is ~441 (sqrt(255²+255²+255²), i.e. black vs white).
 *   Lower values require pixels to be closer to pure white to be removed.
 *   Default of 30 handles slight off-white and JPEG-artifact grays.
 * @returns {Promise<string>} Base64-encoded PNG with transparent background (without data URI prefix)
 */
export async function removeWhiteBackground(base64Image, threshold = 30) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = `data:image/png;base64,${base64Image}`;
  });

  const w = img.width;
  const h = img.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const totalPixels = w * h;

  // Pre-compute squared threshold to avoid sqrt in hot loop
  const thresholdSq = threshold * threshold;

  /**
   * Check whether pixel at the given flat index is "white-ish".
   * Considers both already-transparent pixels and near-white pixels.
   */
  function isWhitish(idx) {
    const off = idx * 4;
    // Already transparent – treat as background
    if (data[off + 3] < 10) return true;
    const dr = 255 - data[off];
    const dg = 255 - data[off + 1];
    const db = 255 - data[off + 2];
    return (dr * dr + dg * dg + db * db) <= thresholdSq;
  }

  // Flood-fill BFS from all edge pixels that are white-ish.
  // Uses index-based queue (head pointer) to avoid O(n) Array.shift().
  const visited = new Uint8Array(totalPixels);
  const queue = [];
  let head = 0;

  // Seed: top and bottom edges
  for (let x = 0; x < w; x++) {
    const top = x;
    if (!visited[top] && isWhitish(top)) {
      visited[top] = 1;
      queue.push(top);
    }
    const bot = (h - 1) * w + x;
    if (!visited[bot] && isWhitish(bot)) {
      visited[bot] = 1;
      queue.push(bot);
    }
  }

  // Seed: left and right edges (excluding corners already handled)
  for (let y = 1; y < h - 1; y++) {
    const left = y * w;
    if (!visited[left] && isWhitish(left)) {
      visited[left] = 1;
      queue.push(left);
    }
    const right = y * w + (w - 1);
    if (!visited[right] && isWhitish(right)) {
      visited[right] = 1;
      queue.push(right);
    }
  }

  // BFS expansion
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx - x) / w;

    // 4-connected neighbors
    if (x > 0) {
      const n = idx - 1;
      if (!visited[n] && isWhitish(n)) { visited[n] = 1; queue.push(n); }
    }
    if (x < w - 1) {
      const n = idx + 1;
      if (!visited[n] && isWhitish(n)) { visited[n] = 1; queue.push(n); }
    }
    if (y > 0) {
      const n = idx - w;
      if (!visited[n] && isWhitish(n)) { visited[n] = 1; queue.push(n); }
    }
    if (y < h - 1) {
      const n = idx + w;
      if (!visited[n] && isWhitish(n)) { visited[n] = 1; queue.push(n); }
    }
  }

  // Make all visited (background) pixels fully transparent
  for (let i = 0; i < totalPixels; i++) {
    if (visited[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}
