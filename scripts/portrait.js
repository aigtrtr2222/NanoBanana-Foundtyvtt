/**
 * NanoBanana Map Editor - Portrait & Token Utilities
 * Core functions for loading, uploading, and updating actor portrait/token images,
 * as well as scanning token example folders.
 */

const MODULE_ID = "nanobanana-map-editor";
const TOKEN_EXAMPLES_DIR = "nanobanana-map-editor/token-examples";

/**
 * Load an image from a Foundry path or URL and return as base64 (without data URI prefix).
 * @param {string} imagePath - The image path (relative or absolute URL)
 * @returns {Promise<string>} Base64-encoded image data
 */
export async function loadImageAsBase64(imagePath) {
  if (!imagePath) throw new Error("No image path provided");

  const url = imagePath.startsWith("http") || imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load image: ${imagePath}`);

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.replace(/^data:image\/[^;]+;base64,/, "");
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload a base64 image to the server and return the path.
 * @param {string} imageBase64 - Base64-encoded image (without data URI prefix)
 * @param {string} [filenamePrefix="nanobanana-portrait"] - Prefix for the filename
 * @returns {Promise<string>} The uploaded file path
 */
export async function uploadImage(imageBase64, filenamePrefix = "nanobanana-portrait") {
  const byteString = atob(imageBase64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: "image/png" });
  const timestamp = Date.now();
  const filename = `${filenamePrefix}-${timestamp}.png`;
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
    throw new Error("Failed to upload image to server.");
  }
  return uploadResponse.path;
}

/**
 * Update a character's portrait image.
 * @param {Actor} actor - The Foundry actor document
 * @param {string} imagePath - The new portrait image path
 */
export async function updateActorPortrait(actor, imagePath) {
  await actor.update({ img: imagePath });
}

/**
 * Update a character's prototype token image and any placed tokens on the current scene.
 * @param {Actor} actor - The Foundry actor document
 * @param {string} imagePath - The new token image path
 */
export async function updateActorToken(actor, imagePath) {
  await actor.update({ "prototypeToken.texture.src": imagePath });

  // Also update any placed tokens on the current scene
  if (canvas.scene) {
    const tokens = canvas.scene.tokens.filter((t) => t.actorId === actor.id);
    for (const token of tokens) {
      await token.update({ "texture.src": imagePath });
    }
  }
}

/**
 * Scan the token examples directory for example images.
 * Each example can have a companion .txt file containing its prompt.
 * @returns {Promise<Array<{path: string, name: string, prompt: string}>>}
 */
export async function scanTokenExamples() {
  const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;

  try {
    await FP.createDirectory("data", TOKEN_EXAMPLES_DIR);
  } catch {
    // Directory may already exist
  }

  try {
    const result = await FP.browse("data", TOKEN_EXAMPLES_DIR);
    if (!result?.files?.length) return [];

    const allFiles = new Set(result.files);

    const imageFiles = result.files.filter((f) =>
      /\.(png|jpg|jpeg|webp)$/i.test(f)
    );

    const examples = [];
    for (const imgPath of imageFiles) {
      const name = imgPath.split("/").pop().replace(/\.[^.]+$/, "");

      // Only fetch the companion .txt file if it exists in the directory listing
      const promptPath = imgPath.replace(/\.[^.]+$/, ".txt");
      let prompt = "";
      if (allFiles.has(promptPath)) {
        try {
          const promptResponse = await fetch(`/${promptPath}`);
          if (promptResponse.ok) {
            prompt = await promptResponse.text();
          }
        } catch {
          // No prompt file available
        }
      }

      examples.push({ path: imgPath, name, prompt: prompt.trim() });
    }
    return examples;
  } catch {
    return [];
  }
}

/**
 * Remove background from a base64 image using shape-based segmentation (U²-Net).
 * Uses @imgly/background-removal loaded from CDN for accurate foreground detection
 * that preserves white/light-colored character features (hair, skin, clothing).
 * @param {string} imageBase64 - Base64-encoded image (without data URI prefix)
 * @returns {Promise<string>} Base64-encoded PNG image with transparent background
 */
export async function removeBackground(imageBase64) {
  // Dynamically load @imgly/background-removal from CDN
  const { removeBackground: removeBg } = await import(
    "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1/dist/index.js"
  );

  // Convert base64 to Blob for the library
  const byteString = atob(imageBase64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const inputBlob = new Blob([ab], { type: "image/png" });

  // Run shape-based background removal (U²-Net segmentation)
  const resultBlob = await removeBg(inputBlob);

  // Convert result Blob back to base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.replace(/^data:image\/[^;]+;base64,/, "");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to process background removal result"));
    reader.readAsDataURL(resultBlob);
  });
}
