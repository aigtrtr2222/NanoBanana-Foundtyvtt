/**
 * NanoBanana Map Editor - Portrait & Token Dialogs
 * UI dialogs for editing character portraits, tokens, and generating tokens from examples.
 */

import { getSetting } from "./settings.js";
import { NANOBANANA_MODELS, sendImg2Img, sendMultiImageGeneration } from "./api.js";
import {
  loadImageAsBase64,
  uploadImage,
  updateActorPortrait,
  updateActorToken,
  scanTokenExamples,
} from "./portrait.js";

/**
 * Show a dialog for editing a character's portrait with AI.
 * @param {Actor} actor - The Foundry actor document
 */
export async function showPortraitEditDialog(actor) {
  const portraitPath = actor.img;
  if (!portraitPath || portraitPath === "icons/svg/mystery-man.svg") {
    ui.notifications.warn(game.i18n.localize("NANOBANANA.PortraitNoImage"));
    return;
  }

  const currentModel = getSetting("model") || "gemini-2.5-flash-image";
  const modelOptions = Object.entries(NANOBANANA_MODELS)
    .map(([id, label]) => `<option value="${id}" ${id === currentModel ? "selected" : ""}>${label}</option>`)
    .join("");

  const content = `
    <form class="nanobanana-dialog nanobanana-portrait-dialog">
      <div class="form-group">
        <div class="preview-container">
          <img src="${_escapeHtml(portraitPath)}" alt="Portrait"/>
          <div class="preview-label">${_escapeHtml(actor.name)} - ${game.i18n.localize("NANOBANANA.PortraitLabel")}</div>
        </div>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogModelLabel")}</label>
        <select name="model">${modelOptions}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogPromptLabel")}</label>
        <textarea name="prompt" placeholder="${game.i18n.localize("NANOBANANA.PortraitPromptPlaceholder")}"></textarea>
      </div>
    </form>
  `;

  return new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize("NANOBANANA.PortraitEditTitle") },
      content,
      buttons: [
        {
          action: "generate",
          label: game.i18n.localize("NANOBANANA.DialogGenerate"),
          icon: "fas fa-magic",
          default: true,
          callback: async (event, button, dialogRef) => {
            const { prompt, model } = _extractFormData(dialogRef, currentModel);
            if (!prompt) {
              ui.notifications.warn(game.i18n.localize("NANOBANANA.ErrorNoPrompt"));
              resolve(null);
              return;
            }

            try {
              ui.notifications.info(game.i18n.localize("NANOBANANA.PortraitGenerating"));
              const portraitBase64 = await loadImageAsBase64(portraitPath);
              const resultBase64 = await sendImg2Img(portraitBase64, { prompt, model });
              const newPath = await uploadImage(resultBase64, "nanobanana-portrait");
              await updateActorPortrait(actor, newPath);
              ui.notifications.info(game.i18n.localize("NANOBANANA.PortraitSuccess"));
              resolve(newPath);
            } catch (err) {
              console.error("nanobanana-map-editor | Portrait edit error:", err);
              ui.notifications.error(
                game.i18n.format("NANOBANANA.ErrorApiFailed", { error: err.message })
              );
              resolve(null);
            }
          },
        },
        {
          action: "cancel",
          label: game.i18n.localize("NANOBANANA.DialogCancel"),
          icon: "fas fa-times",
          callback: () => resolve(null),
        },
      ],
      close: () => resolve(null),
    });
    dialog.render(true);
  });
}

/**
 * Show a dialog for editing a character's token with AI.
 * @param {Actor} actor - The Foundry actor document
 */
export async function showTokenEditDialog(actor) {
  const tokenPath = actor.prototypeToken?.texture?.src;
  if (!tokenPath || tokenPath === "icons/svg/mystery-man.svg") {
    ui.notifications.warn(game.i18n.localize("NANOBANANA.TokenNoImage"));
    return;
  }

  const currentModel = getSetting("model") || "gemini-2.5-flash-image";
  const modelOptions = Object.entries(NANOBANANA_MODELS)
    .map(([id, label]) => `<option value="${id}" ${id === currentModel ? "selected" : ""}>${label}</option>`)
    .join("");

  const content = `
    <form class="nanobanana-dialog nanobanana-portrait-dialog">
      <div class="form-group">
        <div class="preview-container">
          <img src="${_escapeHtml(tokenPath)}" alt="Token"/>
          <div class="preview-label">${_escapeHtml(actor.name)} - ${game.i18n.localize("NANOBANANA.TokenLabel")}</div>
        </div>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogModelLabel")}</label>
        <select name="model">${modelOptions}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogPromptLabel")}</label>
        <textarea name="prompt" placeholder="${game.i18n.localize("NANOBANANA.TokenPromptPlaceholder")}"></textarea>
      </div>
    </form>
  `;

  return new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize("NANOBANANA.TokenEditTitle") },
      content,
      buttons: [
        {
          action: "generate",
          label: game.i18n.localize("NANOBANANA.DialogGenerate"),
          icon: "fas fa-magic",
          default: true,
          callback: async (event, button, dialogRef) => {
            const { prompt, model } = _extractFormData(dialogRef, currentModel);
            if (!prompt) {
              ui.notifications.warn(game.i18n.localize("NANOBANANA.ErrorNoPrompt"));
              resolve(null);
              return;
            }

            try {
              ui.notifications.info(game.i18n.localize("NANOBANANA.TokenGenerating"));
              const tokenBase64 = await loadImageAsBase64(tokenPath);
              const resultBase64 = await sendImg2Img(tokenBase64, { prompt, model });
              const newPath = await uploadImage(resultBase64, "nanobanana-token");
              await updateActorToken(actor, newPath);
              ui.notifications.info(game.i18n.localize("NANOBANANA.TokenSuccess"));
              resolve(newPath);
            } catch (err) {
              console.error("nanobanana-map-editor | Token edit error:", err);
              ui.notifications.error(
                game.i18n.format("NANOBANANA.ErrorApiFailed", { error: err.message })
              );
              resolve(null);
            }
          },
        },
        {
          action: "cancel",
          label: game.i18n.localize("NANOBANANA.DialogCancel"),
          icon: "fas fa-times",
          callback: () => resolve(null),
        },
      ],
      close: () => resolve(null),
    });
    dialog.render(true);
  });
}

/**
 * Show a dialog for generating a token from a portrait using example references.
 * Scans the token examples directory and lets the user select which examples to use.
 * @param {Actor} actor - The Foundry actor document
 */
export async function showTokenGenerateDialog(actor) {
  const portraitPath = actor.img;
  if (!portraitPath || portraitPath === "icons/svg/mystery-man.svg") {
    ui.notifications.warn(game.i18n.localize("NANOBANANA.PortraitNoImage"));
    return;
  }

  // Scan for token examples
  ui.notifications.info(game.i18n.localize("NANOBANANA.TokenGenScanning"));
  const examples = await scanTokenExamples();

  const currentModel = getSetting("model") || "gemini-2.5-flash-image";
  const modelOptions = Object.entries(NANOBANANA_MODELS)
    .map(([id, label]) => `<option value="${id}" ${id === currentModel ? "selected" : ""}>${label}</option>`)
    .join("");

  // Build examples gallery HTML
  let examplesHtml;
  if (examples.length > 0) {
    const exampleItems = examples
      .map(
        (ex, idx) => `
        <label class="nanobanana-example-item">
          <input type="checkbox" name="example-${idx}" value="${idx}" checked />
          <img src="${_escapeHtml(ex.path)}" alt="${_escapeHtml(ex.name)}" title="${_escapeHtml(ex.name)}${ex.prompt ? "\n" + _escapeHtml(ex.prompt) : ""}" />
          <span class="example-name">${_escapeHtml(ex.name)}</span>
        </label>`
      )
      .join("");
    examplesHtml = `
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.TokenGenExamplesLabel")}</label>
        <div class="nanobanana-examples-gallery">${exampleItems}</div>
      </div>`;
  } else {
    examplesHtml = `
      <div class="form-group">
        <div class="nanobanana-no-examples">
          <i class="fas fa-info-circle"></i>
          ${game.i18n.localize("NANOBANANA.TokenGenNoExamples")}
        </div>
      </div>`;
  }

  const content = `
    <form class="nanobanana-dialog nanobanana-portrait-dialog nanobanana-token-gen-dialog">
      <div class="form-group">
        <div class="preview-container">
          <img src="${_escapeHtml(portraitPath)}" alt="Portrait"/>
          <div class="preview-label">${_escapeHtml(actor.name)} - ${game.i18n.localize("NANOBANANA.PortraitLabel")}</div>
        </div>
      </div>
      ${examplesHtml}
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogModelLabel")}</label>
        <select name="model">${modelOptions}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogPromptLabel")}</label>
        <textarea name="prompt" placeholder="${game.i18n.localize("NANOBANANA.TokenGenPromptPlaceholder")}">${game.i18n.localize("NANOBANANA.TokenGenDefaultPrompt")}</textarea>
      </div>
    </form>
  `;

  return new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize("NANOBANANA.TokenGenerateTitle") },
      content,
      buttons: [
        {
          action: "generate",
          label: game.i18n.localize("NANOBANANA.DialogGenerate"),
          icon: "fas fa-magic",
          default: true,
          callback: async (event, button, dialogRef) => {
            const { prompt, model } = _extractFormData(dialogRef, currentModel);
            if (!prompt) {
              ui.notifications.warn(game.i18n.localize("NANOBANANA.ErrorNoPrompt"));
              resolve(null);
              return;
            }

            try {
              // Collect selected examples
              const selectedExamples = _getSelectedExamples(dialogRef, examples);

              ui.notifications.info(game.i18n.localize("NANOBANANA.TokenGenerating"));

              // Load portrait image
              const portraitBase64 = await loadImageAsBase64(portraitPath);

              let resultBase64;
              if (selectedExamples.length > 0) {
                // Load selected example images
                const images = [{ base64: portraitBase64 }];
                for (const ex of selectedExamples) {
                  const exBase64 = await loadImageAsBase64(ex.path);
                  images.push({ base64: exBase64 });
                }

                // Build prompt with example context
                const examplePrompts = selectedExamples
                  .filter((ex) => ex.prompt)
                  .map((ex) => ex.prompt)
                  .join("\n");
                const fullPrompt = examplePrompts
                  ? `${prompt}\n\nReference style descriptions:\n${examplePrompts}`
                  : prompt;

                resultBase64 = await sendMultiImageGeneration(images, {
                  prompt: fullPrompt,
                  model,
                });
              } else {
                // No examples selected; use portrait-only generation
                resultBase64 = await sendImg2Img(portraitBase64, { prompt, model });
              }

              const newPath = await uploadImage(resultBase64, "nanobanana-token-gen");
              await updateActorToken(actor, newPath);
              ui.notifications.info(game.i18n.localize("NANOBANANA.TokenSuccess"));
              resolve(newPath);
            } catch (err) {
              console.error("nanobanana-map-editor | Token generation error:", err);
              ui.notifications.error(
                game.i18n.format("NANOBANANA.ErrorApiFailed", { error: err.message })
              );
              resolve(null);
            }
          },
        },
        {
          action: "cancel",
          label: game.i18n.localize("NANOBANANA.DialogCancel"),
          icon: "fas fa-times",
          callback: () => resolve(null),
        },
      ],
      close: () => resolve(null),
    });
    dialog.render(true);
  });
}

/* ------------------------------------------------------------------ */
/*  Internal Helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Escape a string for safe insertion into HTML attributes/content.
 */
function _escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Extract prompt and model values from a DialogV2 callback reference.
 * Handles multiple Foundry VTT v13 DialogV2 callback signatures.
 */
function _extractFormData(dialogRef, fallbackModel) {
  let prompt, model;

  if (dialogRef?.object) {
    prompt = dialogRef.object.prompt;
    model = dialogRef.object.model;
  } else if (dialogRef?.querySelector) {
    const form = dialogRef.querySelector("form") ?? dialogRef.closest?.(".dialog-content")?.querySelector("form");
    if (form) {
      prompt = form.querySelector('[name="prompt"]')?.value;
      model = form.querySelector('[name="model"]')?.value;
    }
  } else if (dialogRef?.element) {
    const el = dialogRef.element;
    const form = el.querySelector?.("form");
    if (form) {
      prompt = form.querySelector('[name="prompt"]')?.value;
      model = form.querySelector('[name="model"]')?.value;
    }
  }

  // DOM fallback
  if (prompt === undefined || prompt === null) {
    const forms = document.querySelectorAll(".nanobanana-portrait-dialog");
    for (const f of forms) {
      const p = f.querySelector('[name="prompt"]')?.value;
      if (p !== undefined) {
        prompt = p;
        model = f.querySelector('[name="model"]')?.value;
        break;
      }
    }
  }

  prompt = typeof prompt === "string" ? prompt.trim() : "";
  model = model || fallbackModel;
  return { prompt, model };
}

/**
 * Get selected example indices from checkboxes in the dialog.
 */
function _getSelectedExamples(dialogRef, examples) {
  let formEl;

  if (dialogRef?.element) {
    formEl = dialogRef.element.querySelector?.("form");
  } else if (dialogRef?.querySelector) {
    formEl = dialogRef.querySelector("form");
  }

  // DOM fallback
  if (!formEl) {
    formEl = document.querySelector(".nanobanana-token-gen-dialog");
  }

  if (!formEl) return examples; // If can't find form, use all examples

  const selected = [];
  for (let i = 0; i < examples.length; i++) {
    const checkbox = formEl.querySelector(`[name="example-${i}"]`);
    if (checkbox && checkbox.checked) {
      selected.push(examples[i]);
    }
  }
  return selected;
}
