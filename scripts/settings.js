/**
 * NanoBanana Map Editor - Module Settings
 * Registers all module settings for the Google Generative AI (Gemini / Imagen) integration.
 */

import { NANOBANANA_MODELS } from "./api.js";

const MODULE_ID = "nanobanana-map-editor";

export function registerSettings() {
  game.settings.register(MODULE_ID, "apiKey", {
    name: game.i18n.localize("NANOBANANA.SettingsApiKey"),
    hint: game.i18n.localize("NANOBANANA.SettingsApiKeyHint"),
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_ID, "model", {
    name: game.i18n.localize("NANOBANANA.SettingsModel"),
    hint: game.i18n.localize("NANOBANANA.SettingsModelHint"),
    scope: "world",
    config: true,
    type: String,
    default: "gemini-2.0-flash-exp",
    choices: NANOBANANA_MODELS,
  });
}

/**
 * Get a module setting value.
 * @param {string} key - The setting key
 * @returns {*} The setting value
 */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}
