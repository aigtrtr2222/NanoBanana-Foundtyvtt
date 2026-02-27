/**
 * NanoBanana Map Editor – api.mjs
 *
 * Sends a captured map region (base64 PNG) and a text prompt to the
 * NanoBanana2 REST API and returns the AI-edited image as a base64 data URL.
 *
 * Default request format (POST <apiUrl>/edit):
 *   Content-Type: application/json
 *   { "image": "<base64 without prefix>", "prompt": "..." }
 *
 * Default response format:
 *   { "result": "<base64>" }        ← preferred key
 *   { "image": "<base64>" }         ← alternative
 *   { "output": "<base64>" }        ← alternative
 *   { "generated_image": "<base64>" } ← alternative
 *
 * Any field that is already a data-URL (starts with "data:") is returned as-is.
 * The API key (if set) is sent as "Authorization: Bearer <key>".
 */

/**
 * Call the NanoBanana2 API.
 *
 * @param {string} apiUrl      Base URL of the NanoBanana2 server
 * @param {string} apiKey      Optional API key / Bearer token
 * @param {string} imageDataUrl  Source image as a data URL (data:image/png;base64,…)
 * @param {string} prompt      Text prompt describing the desired edit
 * @returns {Promise<string>}  Edited image as a data URL
 */
export async function callNanoBananaAPI(apiUrl, apiKey, imageDataUrl, prompt) {
  // Strip the "data:image/…;base64," prefix so we send only the raw base64
  const base64Data = imageDataUrl.includes(',')
    ? imageDataUrl.split(',')[1]
    : imageDataUrl;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const endpoint = apiUrl.replace(/\/$/, '') + '/edit';

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image: base64Data, prompt }),
    });
  } catch (networkErr) {
    throw new Error(
      game.i18n.format('NANOBANANA.Errors.NetworkError', { endpoint, message: networkErr.message })
    );
  }

  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch (_) { /* ignore */ }
    throw new Error(
      game.i18n.format('NANOBANANA.Errors.ApiError',
        { status: response.status, statusText: response.statusText, detail }).trim()
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new Error(game.i18n.localize('NANOBANANA.Errors.InvalidJson'));
  }

  // Accept several common key names for the result image
  const raw = data.result ?? data.image ?? data.output ?? data.generated_image;
  if (!raw) {
    throw new Error(
      game.i18n.format('NANOBANANA.Errors.NoImageInResponse', { keys: Object.keys(data).join(', ') })
    );
  }

  // Return as a proper data URL
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
}
