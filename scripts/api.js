/**
 * NanoBanana Map Editor - API Communication
 * Handles communication with the NanoBanana2 (Stable Diffusion WebUI) API.
 */

import { getSetting } from "./settings.js";

/**
 * Send an img2img request to the NanoBanana2 API.
 * @param {string} imageBase64 - Base64-encoded source image (without data URI prefix)
 * @param {object} options - Generation options
 * @param {string} options.prompt - The positive prompt
 * @param {string} [options.negativePrompt] - The negative prompt
 * @param {number} [options.denoisingStrength] - Denoising strength (0.0-1.0)
 * @param {number} [options.steps] - Number of sampling steps
 * @param {number} [options.cfgScale] - CFG scale value
 * @param {string} [options.sampler] - Sampler name
 * @param {number} [options.width] - Output image width
 * @param {number} [options.height] - Output image height
 * @returns {Promise<string>} Base64-encoded result image
 */
export async function sendImg2Img(imageBase64, options) {
  const apiUrl = getSetting("apiUrl");
  if (!apiUrl) {
    throw new Error(game.i18n.localize("NANOBANANA.ErrorNoApi"));
  }

  const baseUrl = apiUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/sdapi/v1/img2img`;

  const payload = {
    init_images: [imageBase64],
    prompt: options.prompt || "",
    negative_prompt:
      options.negativePrompt ?? getSetting("negativePrompt") ?? "",
    denoising_strength:
      options.denoisingStrength ?? getSetting("denoisingStrength") ?? 0.75,
    steps: options.steps ?? getSetting("steps") ?? 20,
    cfg_scale: options.cfgScale ?? getSetting("cfgScale") ?? 7,
    sampler_name: options.sampler ?? getSetting("sampler") ?? "Euler a",
    width: options.width || 512,
    height: options.height || 512,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      game.i18n.format("NANOBANANA.ErrorApiFailed", { error: errorText })
    );
  }

  const result = await response.json();

  if (!result.images || result.images.length === 0) {
    throw new Error(
      game.i18n.format("NANOBANANA.ErrorApiFailed", {
        error: "No images returned",
      })
    );
  }

  return result.images[0];
}

/**
 * Check if the NanoBanana2 API is reachable.
 * @returns {Promise<boolean>}
 */
export async function checkApiConnection() {
  try {
    const apiUrl = getSetting("apiUrl");
    if (!apiUrl) return false;
    const baseUrl = apiUrl.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/sdapi/v1/sd-models`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
