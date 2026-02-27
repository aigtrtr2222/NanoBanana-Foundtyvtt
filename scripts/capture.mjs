/**
 * NanoBanana Map Editor – capture.mjs
 *
 * Manages the drag-to-select overlay on the FoundryVTT canvas and extracts
 * the selected scene region as a base64 PNG data URL using PIXI's extract API.
 */

export class NanaBananaCapturer {
  /** @param {Function} onCapture  async (dataUrl, sceneX, sceneY, sceneW, sceneH) => void */
  constructor(onCapture) {
    this.onCapture = onCapture;
    this.active = false;

    this._overlay = null;
    this._selection = null;
    this._dragStart = null;

    // Bound handlers so we can remove them cleanly
    this._onMouseDown = this._mouseDown.bind(this);
    this._onMouseMove = this._mouseMove.bind(this);
    this._onMouseUp   = this._mouseUp.bind(this);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  activate() {
    if (this.active) return;
    this.active = true;
    this._createOverlay();
    console.log('NanoBanana | Capture mode activated');
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    this._removeOverlay();
    console.log('NanoBanana | Capture mode deactivated');
  }

  toggle() {
    this.active ? this.deactivate() : this.activate();
  }

  // -------------------------------------------------------------------------
  // Overlay management
  // -------------------------------------------------------------------------

  _createOverlay() {
    this._removeOverlay();

    const board = document.getElementById('board');
    if (!board) {
      console.error('NanoBanana | #board element not found');
      return;
    }

    this._overlay = document.createElement('div');
    this._overlay.id = 'nanobanana-overlay';

    this._selection = document.createElement('div');
    this._selection.id = 'nanobanana-selection';

    this._overlay.appendChild(this._selection);
    board.appendChild(this._overlay);

    this._overlay.addEventListener('mousedown', this._onMouseDown);
  }

  _removeOverlay() {
    if (!this._overlay) return;
    this._overlay.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    this._overlay.remove();
    this._overlay  = null;
    this._selection = null;
    this._dragStart = null;
  }

  // -------------------------------------------------------------------------
  // Mouse event handlers
  // -------------------------------------------------------------------------

  _mouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    const board = document.getElementById('board');
    const rect  = board.getBoundingClientRect();

    this._dragStart = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    const sel = this._selection;
    sel.style.left    = `${this._dragStart.x}px`;
    sel.style.top     = `${this._dragStart.y}px`;
    sel.style.width   = '0';
    sel.style.height  = '0';
    sel.style.display = 'block';

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup',   this._onMouseUp);
  }

  _mouseMove(event) {
    if (!this._dragStart) return;

    const board = document.getElementById('board');
    const rect  = board.getBoundingClientRect();

    const curX = event.clientX - rect.left;
    const curY = event.clientY - rect.top;

    const x = Math.min(this._dragStart.x, curX);
    const y = Math.min(this._dragStart.y, curY);
    const w = Math.abs(curX - this._dragStart.x);
    const h = Math.abs(curY - this._dragStart.y);

    const sel = this._selection;
    sel.style.left   = `${x}px`;
    sel.style.top    = `${y}px`;
    sel.style.width  = `${w}px`;
    sel.style.height = `${h}px`;
  }

  async _mouseUp(event) {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);

    if (!this._dragStart) return;

    const board = document.getElementById('board');
    const rect  = board.getBoundingClientRect();

    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;

    const screenX = Math.min(this._dragStart.x, endX);
    const screenY = Math.min(this._dragStart.y, endY);
    const screenW = Math.abs(endX - this._dragStart.x);
    const screenH = Math.abs(endY - this._dragStart.y);

    // Hide selection rectangle
    if (this._selection) this._selection.style.display = 'none';
    this._dragStart = null;

    // Ignore tiny selections
    if (screenW < 10 || screenH < 10) {
      this.deactivate();
      return;
    }

    // Convert screen (CSS pixel) coordinates → scene coordinates
    const { x: sceneX, y: sceneY, width: sceneW, height: sceneH } =
      this._screenToScene(screenX, screenY, screenW, screenH);

    this.deactivate();

    try {
      const dataUrl = await this._captureSceneRegion(sceneX, sceneY, sceneW, sceneH);
      await this.onCapture(dataUrl, sceneX, sceneY, sceneW, sceneH);
    } catch (err) {
      console.error('NanoBanana | Capture error:', err);
      ui.notifications.error(`NanoBanana: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Coordinate conversion
  // -------------------------------------------------------------------------

  /**
   * Convert CSS-pixel coordinates relative to #board to scene coordinates.
   * canvas.stage.transform.worldTransform maps scene → screen:
   *   screenX = sceneX * a + tx
   *   screenY = sceneY * d + ty
   */
  _screenToScene(screenX, screenY, screenW, screenH) {
    const t = canvas.stage.transform.worldTransform;
    return {
      x:      (screenX - t.tx) / t.a,
      y:      (screenY - t.ty) / t.d,
      width:  screenW / t.a,
      height: screenH / t.d,
    };
  }

  // -------------------------------------------------------------------------
  // PIXI region capture
  // -------------------------------------------------------------------------

  /**
   * Render canvas.primary (background + tiles) into a PIXI RenderTexture and
   * extract it as a base64 PNG.  Supports both PIXI v7 (FVTT ≤ v11) and
   * PIXI v8 (FVTT v12+) APIs.
   */
  async _captureSceneRegion(x, y, width, height) {
    const renderer = canvas.app.renderer;
    const w = Math.max(1, Math.ceil(width));
    const h = Math.max(1, Math.ceil(height));

    // Prefer PIXI v8 extract API: extract.base64(target, format, quality, frame)
    if (renderer.extract?.base64) {
      const frame  = new PIXI.Rectangle(x, y, width, height);
      const result = renderer.extract.base64(canvas.primary, 'image/png', 1.0, frame);
      // PIXI v8 returns a Promise; PIXI v7 might return a string
      return result instanceof Promise ? await result : result;
    }

    // Fallback: manual RenderTexture approach
    const rt     = PIXI.RenderTexture.create({ width: w, height: h });
    const matrix = new PIXI.Matrix().translate(-x, -y);

    // PIXI v8 render options object; fall back to PIXI v7 positional args
    try {
      renderer.render(canvas.primary, { renderTexture: rt, transform: matrix, clear: true });
    } catch (_) {
      renderer.render(canvas.primary, rt, true, matrix, false);
    }

    const extracted = renderer.extract.canvas(rt);
    const dataUrl   = extracted.toDataURL('image/png');
    rt.destroy(true);
    return dataUrl;
  }
}
