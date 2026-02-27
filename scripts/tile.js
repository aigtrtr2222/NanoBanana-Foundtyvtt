/**
 * NanoBanana Map Editor - Tile Placement
 * Places the AI-generated image as a tile on the canvas.
 */

const MODULE_ID = "nanobanana-map-editor";

/**
 * Save a base64 image to the server and place it as a tile at the specified position.
 * @param {string} imageBase64 - Base64-encoded image (without data URI prefix)
 * @param {object} rect - The position/size rectangle in scene coordinates
 * @param {number} rect.x - Left edge
 * @param {number} rect.y - Top edge
 * @param {number} rect.width - Width
 * @param {number} rect.height - Height
 * @returns {Promise<TileDocument>} The created tile document
 */
export async function placeTile(imageBase64, rect) {
  // Convert base64 to a File object
  const byteString = atob(imageBase64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: "image/png" });
  const timestamp = Date.now();
  const filename = `nanobanana-${timestamp}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  // Upload to the Foundry data directory
  const uploadDir = `nanobanana-map-editor`;

  // Ensure the directory exists by using FilePicker
  try {
    await FilePicker.createDirectory("data", uploadDir);
  } catch {
    // Directory may already exist; ignore error
  }

  const uploadResponse = await FilePicker.upload("data", uploadDir, file);
  if (!uploadResponse?.path) {
    throw new Error("Failed to upload generated image to server.");
  }

  const imagePath = uploadResponse.path;

  // Create the tile on the current scene
  const tileData = {
    texture: { src: imagePath },
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    overhead: false,
    flags: {
      [MODULE_ID]: { generated: true, timestamp },
    },
  };

  const scene = canvas.scene;
  const [tile] = await scene.createEmbeddedDocuments("Tile", [tileData]);
  return tile;
}
