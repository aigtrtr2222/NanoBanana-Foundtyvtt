/**
 * NanoBanana Map Editor - Prompt Dialog
 * Shows a dialog for the user to input generation parameters.
 */

import { getSetting } from "./settings.js";
import { NANOBANANA_MODELS } from "./api.js";

/**
 * Show the prompt dialog with a preview of the captured region.
 * @param {string} previewBase64 - Base64-encoded preview image
 * @param {object} rect - The capture rectangle (for display info)
 * @returns {Promise<object|null>} The dialog result or null if cancelled
 */
export async function showPromptDialog(previewBase64, rect) {
  const currentModel = getSetting("model") || "gemini-2.5-flash-image";

  const modelOptions = Object.entries(NANOBANANA_MODELS)
    .map(([id, label]) => `<option value="${id}" ${id === currentModel ? "selected" : ""}>${label}</option>`)
    .join("");

  const content = `
    <form class="nanobanana-dialog">
      <div class="form-group">
        <div class="preview-container">
          <img src="data:image/png;base64,${previewBase64}" alt="Captured Region"/>
          <div class="preview-label">${Math.round(rect.width)} × ${Math.round(rect.height)} px</div>
        </div>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogModelLabel")}</label>
        <select name="model">${modelOptions}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogPromptLabel")}</label>
        <textarea name="prompt" placeholder="${game.i18n.localize("NANOBANANA.DialogPromptPlaceholder")}"></textarea>
      </div>
    </form>
  `;

  return new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: {
        title: game.i18n.localize("NANOBANANA.DialogTitle"),
      },
      content,
      buttons: [
        {
          action: "generate",
          label: game.i18n.localize("NANOBANANA.DialogGenerate"),
          icon: "fas fa-magic",
          default: true,
          callback: (event, button, dialogRef) => {
            let prompt, model;

            // Foundry VTT v13 DialogV2 passes FormDataExtended as 3rd arg
            if (dialogRef?.object) {
              prompt = dialogRef.object.prompt;
              model = dialogRef.object.model;
            } else if (dialogRef?.querySelector) {
              // Older API where 3rd arg is an HTMLElement
              const form = dialogRef.querySelector("form") ?? dialogRef.closest?.(".dialog-content")?.querySelector("form");
              if (form) {
                prompt = form.querySelector('[name="prompt"]')?.value;
                model = form.querySelector('[name="model"]')?.value;
              }
            } else if (dialogRef?.element) {
              // Foundry VTT v13: 3rd arg is the DialogV2 instance
              const el = dialogRef.element;
              const form = el.querySelector?.("form");
              if (form) {
                prompt = form.querySelector('[name="prompt"]')?.value;
                model = form.querySelector('[name="model"]')?.value;
              }
            }

            // DOM fallback: find our dialog form directly in the document
            if (prompt === undefined || prompt === null) {
              const forms = document.querySelectorAll(".nanobanana-dialog");
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
            if (!prompt) {
              ui.notifications.warn(game.i18n.localize("NANOBANANA.ErrorNoPrompt"));
              resolve(null);
              return;
            }
            resolve({
              prompt,
              model: model || currentModel,
            });
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
