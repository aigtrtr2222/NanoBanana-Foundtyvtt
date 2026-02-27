/**
 * NanoBanana Map Editor – main.mjs
 *
 * Entry point for the nanobanana-map-editor FoundryVTT v13 module.
 *
 * Flow:
 *  1. GM activates "캡처 & 편집 (NanoBanana)" tool in the Tiles control group
 *     (or presses the default keybinding Alt+M).
 *  2. The DOM overlay becomes active; GM drags a rectangle over the map.
 *  3. The selected region is captured as a PNG via the PIXI renderer.
 *  4. A dialog shows a preview and asks for an editing prompt.
 *  5. The image + prompt is sent to the configured NanoBanana2 API endpoint.
 *  6. The returned image is uploaded to the FoundryVTT data folder and placed
 *     as a Tile at the original scene position.
 */

import { NanaBananaCapturer } from './capture.mjs';
import { callNanoBananaAPI }  from './api.mjs';
import { placeEditedTile }    from './tile-placer.mjs';

const MODULE_ID = 'nanobanana-map-editor';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------
let capturer = null;

// ---------------------------------------------------------------------------
// 1. init – register settings
// ---------------------------------------------------------------------------
Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'apiUrl', {
    name:    'NANOBANANA.Settings.ApiUrl',
    hint:    'NANOBANANA.Settings.ApiUrlHint',
    scope:   'world',
    config:  true,
    type:    String,
    default: 'http://localhost:7860',
  });

  game.settings.register(MODULE_ID, 'apiKey', {
    name:    'NANOBANANA.Settings.ApiKey',
    hint:    'NANOBANANA.Settings.ApiKeyHint',
    scope:   'world',
    config:  true,
    type:    String,
    default: '',
  });

  game.settings.register(MODULE_ID, 'uploadFolder', {
    name:    'NANOBANANA.Settings.UploadFolder',
    hint:    'NANOBANANA.Settings.UploadFolderHint',
    scope:   'world',
    config:  true,
    type:    String,
    default: 'nanobanana-edits',
  });

  console.log('NanoBanana Map Editor | Initialized');
});

// ---------------------------------------------------------------------------
// 2. ready – register keybinding
// ---------------------------------------------------------------------------
Hooks.once('ready', () => {
  if (!game.user.isGM) return;

  game.keybindings.register(MODULE_ID, 'toggleCapture', {
    name:     'NANOBANANA.Keybinding.ToggleCapture',
    hint:     'NANOBANANA.Keybinding.ToggleCaptureHint',
    editable: [{ key: 'KeyM', modifiers: ['Alt'] }],
    onDown:   () => {
      if (!capturer) return;
      capturer.toggle();
      return true; // prevent default browser behaviour
    },
  });
});

// ---------------------------------------------------------------------------
// 3. canvasReady – instantiate the capturer once a scene is loaded
// ---------------------------------------------------------------------------
Hooks.on('canvasReady', () => {
  if (!game.user.isGM) return;

  capturer = new NanaBananaCapturer(_handleCapture);
  // Expose for manual use from the browser console if needed
  game.modules.get(MODULE_ID).capturer = capturer;
});

// ---------------------------------------------------------------------------
// 4. Add a tool button to the Tiles scene control group
// ---------------------------------------------------------------------------
Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.user.isGM) return;

  const tilesGroup = controls.find(c => c.name === 'tiles');
  if (!tilesGroup) return;

  tilesGroup.tools.push({
    name:   'nanobanana-capture',
    title:  'NANOBANANA.CaptureRegion',
    icon:   'fas fa-crop-alt',
    toggle: true,
    active: false,
    onClick: (toggled) => {
      if (!capturer) return;
      toggled ? capturer.activate() : capturer.deactivate();
    },
  });
});

// ---------------------------------------------------------------------------
// 5. Core workflow – called by NanaBananaCapturer after a drag selection
// ---------------------------------------------------------------------------

/**
 * @param {string} imageDataUrl  Captured map region as a PNG data URL
 * @param {number} sceneX        Left edge in scene coordinates
 * @param {number} sceneY        Top  edge in scene coordinates
 * @param {number} sceneW        Width  in scene units
 * @param {number} sceneH        Height in scene units
 */
async function _handleCapture(imageDataUrl, sceneX, sceneY, sceneW, sceneH) {
  // ---- a. Ask the GM for a prompt ----------------------------------------
  const prompt = await _showPromptDialog(imageDataUrl);
  if (!prompt) return; // user cancelled

  // ---- b. Call NanoBanana2 API --------------------------------------------
  const apiUrl      = game.settings.get(MODULE_ID, 'apiUrl');
  const apiKey      = game.settings.get(MODULE_ID, 'apiKey');
  const uploadFolder = game.settings.get(MODULE_ID, 'uploadFolder');

  const loadingMsg = ui.notifications.info(
    game.i18n.localize('NANOBANANA.Processing'), { permanent: true }
  );

  try {
    const resultDataUrl = await callNanoBananaAPI(apiUrl, apiKey, imageDataUrl, prompt);

    // ---- c. Place the result as a tile ------------------------------------
    await placeEditedTile(resultDataUrl, sceneX, sceneY, sceneW, sceneH, uploadFolder);

    ui.notifications.info(game.i18n.localize('NANOBANANA.Success'));
  } catch (err) {
    console.error('NanoBanana Map Editor | Error:', err);
    ui.notifications.error(
      `${game.i18n.localize('NANOBANANA.Error')}: ${err.message}`
    );
  } finally {
    // Dismiss the "Processing…" notification
    if (loadingMsg?.element) loadingMsg.element.remove();
  }
}

// ---------------------------------------------------------------------------
// 6. Prompt dialog
// ---------------------------------------------------------------------------

/**
 * Show a modal dialog with a thumbnail of the captured region and a text
 * field for the editing prompt.  Returns the prompt string or null if the
 * user cancelled.
 *
 * Uses foundry.applications.api.DialogV2 when available (FVTT v13+),
 * falling back to the legacy Dialog class for older versions.
 *
 * @param {string} thumbnailDataUrl
 * @returns {Promise<string|null>}
 */
function _showPromptDialog(thumbnailDataUrl) {
  const content = `
    <div class="nanobanana-dialog">
      <figure class="nanobanana-preview">
        <img src="${thumbnailDataUrl}" alt="캡처 미리보기 / Captured region" />
      </figure>
      <div class="form-group">
        <label for="nanobanana-prompt">
          ${game.i18n.localize('NANOBANANA.PromptLabel')}
        </label>
        <input
          id="nanobanana-prompt"
          type="text"
          name="prompt"
          placeholder="${game.i18n.localize('NANOBANANA.PromptPlaceholder')}"
          autofocus
        />
      </div>
    </div>`;

  // ---- FVTT v13 DialogV2 --------------------------------------------------
  if (foundry?.applications?.api?.DialogV2) {
    return foundry.applications.api.DialogV2.prompt({
      window:  { title: game.i18n.localize('NANOBANANA.DialogTitle') },
      content,
      ok: {
        label:    game.i18n.localize('NANOBANANA.Edit'),
        callback: (_event, _button, dialog) => {
          const input = dialog.querySelector('#nanobanana-prompt');
          return input?.value?.trim() || null;
        },
      },
      rejectClose: false, // resolve with null if closed without clicking OK
    });
  }

  // ---- Legacy Dialog (FVTT v11/v12) ---------------------------------------
  return new Promise((resolve) => {
    new Dialog({
      title:   game.i18n.localize('NANOBANANA.DialogTitle'),
      content,
      buttons: {
        ok: {
          icon:     '<i class="fas fa-check"></i>',
          label:    game.i18n.localize('NANOBANANA.Edit'),
          callback: (html) => {
            const val = (html instanceof HTMLElement
              ? html.querySelector('#nanobanana-prompt')
              : html.find('#nanobanana-prompt')[0])?.value?.trim();
            resolve(val || null);
          },
        },
        cancel: {
          icon:     '<i class="fas fa-times"></i>',
          label:    game.i18n.localize('NANOBANANA.Cancel'),
          callback: () => resolve(null),
        },
      },
      default: 'ok',
      close:   () => resolve(null),
    }).render(true);
  });
}
