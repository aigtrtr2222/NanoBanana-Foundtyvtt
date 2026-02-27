/**
 * NanoBanana Map Editor - Module Settings
 * Registers all module settings for the NanoBanana2 API integration.
 */

const MODULE_ID = "nanobanana-map-editor";

export function registerSettings() {
  game.settings.register(MODULE_ID, "apiUrl", {
    name: game.i18n.localize("NANOBANANA.SettingsApiUrl"),
    hint: game.i18n.localize("NANOBANANA.SettingsApiUrlHint"),
    scope: "world",
    config: true,
    type: String,
    default: "http://127.0.0.1:7860",
  });

  game.settings.register(MODULE_ID, "denoisingStrength", {
    name: game.i18n.localize("NANOBANANA.SettingsDenoisingStrength"),
    hint: game.i18n.localize("NANOBANANA.SettingsDenoisingStrengthHint"),
    scope: "world",
    config: true,
    type: Number,
    default: 0.75,
    range: { min: 0.0, max: 1.0, step: 0.05 },
  });

  game.settings.register(MODULE_ID, "steps", {
    name: game.i18n.localize("NANOBANANA.SettingsSteps"),
    hint: game.i18n.localize("NANOBANANA.SettingsStepsHint"),
    scope: "world",
    config: true,
    type: Number,
    default: 20,
    range: { min: 1, max: 150, step: 1 },
  });

  game.settings.register(MODULE_ID, "cfgScale", {
    name: game.i18n.localize("NANOBANANA.SettingsCfgScale"),
    hint: game.i18n.localize("NANOBANANA.SettingsCfgScaleHint"),
    scope: "world",
    config: true,
    type: Number,
    default: 7,
    range: { min: 1, max: 30, step: 0.5 },
  });

  game.settings.register(MODULE_ID, "sampler", {
    name: game.i18n.localize("NANOBANANA.SettingsSampler"),
    hint: game.i18n.localize("NANOBANANA.SettingsSamplerHint"),
    scope: "world",
    config: true,
    type: String,
    default: "Euler a",
  });

  game.settings.register(MODULE_ID, "negativePrompt", {
    name: game.i18n.localize("NANOBANANA.SettingsNegativePrompt"),
    hint: game.i18n.localize("NANOBANANA.SettingsNegativePromptHint"),
    scope: "world",
    config: true,
    type: String,
    default: "blurry, low quality, distorted, watermark, text",
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
