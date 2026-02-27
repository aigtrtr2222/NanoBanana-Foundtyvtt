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

  const url = imagePath.startsWith("http") ? imagePath : `/${imagePath}`;
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

    const imageFiles = result.files.filter((f) =>
      /\.(png|jpg|jpeg|webp)$/i.test(f)
    );

    const examples = [];
    for (const imgPath of imageFiles) {
      const name = imgPath.split("/").pop().replace(/\.[^.]+$/, "");

      // Try to load a companion prompt .txt file
      const promptPath = imgPath.replace(/\.[^.]+$/, ".txt");
      let prompt = "";
      try {
        const promptResponse = await fetch(`/${promptPath}`);
        if (promptResponse.ok) {
          prompt = await promptResponse.text();
        }
      } catch {
        // No prompt file available
      }

      examples.push({ path: imgPath, name, prompt: prompt.trim() });
    }
    return examples;
  } catch {
    return [];
  }
}
