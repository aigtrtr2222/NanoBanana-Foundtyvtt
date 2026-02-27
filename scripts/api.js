/**
 * NanoBanana Map Editor - API Communication
 * Handles communication with the Google Generative AI (Gemini / Imagen) API.
 */

import { getSetting } from "./settings.js";

/**
 * Available NanoBanana models for image generation/editing.
 *
 * Nano Banana is Gemini's native image generation capability.
 * - Nano Banana: gemini-2.5-flash-image – optimized for speed and high-volume low-latency tasks.
 * - Nano Banana 2: gemini-3.1-flash-image-preview – high-efficiency counterpart of Gemini 3 Pro Image.
 * - Nano Banana Pro: gemini-3-pro-image-preview – designed for professional asset creation with
 *   advanced reasoning for complex instructions and high-fidelity text rendering.
 *
 * All generated images include a SynthID watermark.
 */
export const NANOBANANA_MODELS = {
  "gemini-2.5-flash-image": "Nano Banana (Gemini 2.5 Flash Image)",
  "gemini-3.1-flash-image-preview": "Nano Banana 2 (Gemini 3.1 Flash Image Preview)",
  "gemini-3-pro-image-preview": "Nano Banana Pro (Gemini 3 Pro Image Preview)",
};

/**
 * Send an image editing request to the Google Generative AI API.
 * Uses the Gemini model's generateContent endpoint with multimodal input
 * (image + text prompt) to produce an edited image.
 *
 * @param {string} imageBase64 - Base64-encoded source image (without data URI prefix)
 * @param {object} options - Generation options
 * @param {string} options.prompt - The text prompt describing the desired edit
 * @param {string} [options.model] - Model ID to use
 * @returns {Promise<string>} Base64-encoded result image
 */
export async function sendImg2Img(imageBase64, options) {
  const apiKey = getSetting("apiKey");
  if (!apiKey) {
    throw new Error(game.i18n.localize("NANOBANANA.ErrorNoApi"));
  }

  const model = options.model || getSetting("model") || "gemini-2.5-flash-image";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: imageBase64,
            },
          },
          {
            text: options.prompt || "",
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
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

  // Extract the generated image from the response
  const candidates = result.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error(
      game.i18n.format("NANOBANANA.ErrorApiFailed", {
        error: "No candidates returned",
      })
    );
  }

  const parts = candidates[0]?.content?.parts;
  if (!parts) {
    throw new Error(
      game.i18n.format("NANOBANANA.ErrorApiFailed", {
        error: "No content parts returned",
      })
    );
  }

  // Find the first image part in the response
  for (const part of parts) {
    if (part.inlineData?.data) {
      return part.inlineData.data;
    }
  }

  throw new Error(
    game.i18n.format("NANOBANANA.ErrorApiFailed", {
      error: "No image returned in response",
    })
  );
}

/**
 * Check if the Google Generative AI API is reachable with the configured key.
 * @returns {Promise<boolean>}
 */
export async function checkApiConnection() {
  try {
    const apiKey = getSetting("apiKey");
    if (!apiKey) return false;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
