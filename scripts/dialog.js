/**
 * NanoBanana Map Editor - Prompt Dialog
 * Shows a dialog for the user to input generation parameters.
 */

import { getSetting } from "./settings.js";

/**
 * Show the prompt dialog with a preview of the captured region.
 * @param {string} previewBase64 - Base64-encoded preview image
 * @param {object} rect - The capture rectangle (for display info)
 * @returns {Promise<object|null>} The dialog result or null if cancelled
 */
export async function showPromptDialog(previewBase64, rect) {
  const defaultDenoising = getSetting("denoisingStrength");
  const defaultNegative = getSetting("negativePrompt");

  const content = `
    <form class="nanobanana-dialog">
      <div class="form-group">
        <div class="preview-container">
          <img src="data:image/png;base64,${previewBase64}" alt="Captured Region"/>
          <div class="preview-label">${Math.round(rect.width)} × ${Math.round(rect.height)} px</div>
        </div>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogPromptLabel")}</label>
        <textarea name="prompt" placeholder="${game.i18n.localize("NANOBANANA.DialogPromptPlaceholder")}"></textarea>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogNegativeLabel")}</label>
        <textarea name="negativePrompt" placeholder="${game.i18n.localize("NANOBANANA.DialogNegativePlaceholder")}">${defaultNegative}</textarea>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("NANOBANANA.DialogDenoisingLabel")}: <span id="nb-denoising-val">${defaultDenoising}</span></label>
        <input type="range" name="denoisingStrength" min="0" max="1" step="0.05" value="${defaultDenoising}"/>
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
          callback: (event, button, html) => {
            // DialogV2 may pass different root elements depending on version
            const form = html.querySelector("form") ?? html.closest(".dialog-content")?.querySelector("form");
            if (!form) {
              resolve(null);
              return;
            }
            const prompt = form.querySelector('[name="prompt"]')?.value?.trim();
            if (!prompt) {
              ui.notifications.warn(game.i18n.localize("NANOBANANA.ErrorNoPrompt"));
              resolve(null);
              return;
            }
            resolve({
              prompt,
              negativePrompt: form.querySelector('[name="negativePrompt"]')?.value?.trim() || "",
              denoisingStrength: parseFloat(form.querySelector('[name="denoisingStrength"]')?.value) || defaultDenoising,
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
      render: (event, html) => {
        const slider = html.querySelector('[name="denoisingStrength"]');
        const valSpan = html.querySelector("#nb-denoising-val");
        if (slider && valSpan) {
          slider.addEventListener("input", () => {
            valSpan.textContent = slider.value;
          });
        }
      },
    });
    dialog.render(true);
  });
}
