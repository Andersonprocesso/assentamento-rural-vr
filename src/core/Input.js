export class Input {
  constructor(domElement, bus) {
    this.domElement = domElement;
    this.bus = bus;

    this.keys = Object.create(null);
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.leftDown = false;
    this.rightDown = false;
    this.leftPressed = false;
    this.rightPressed = false;
    this.wheelDelta = 0;
    this.locked = false;
    this.active = false; // só captura jogo quando jogando (não em menu/mapa)

    this._onKeyDown = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!e.repeat) {
        this.bus.emit('input:key', { code: e.code, key: e.key });
      }
      this.keys[e.code] = true;
      if (this.active && (e.code === 'Space' || e.code.startsWith('Arrow'))) {
        e.preventDefault();
      }
    };

    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
    };

    this._onBlur = () => {
      this.keys = Object.create(null);
      this.leftDown = false;
      this.rightDown = false;
    };

    this._onMouseMove = (e) => {
      if (!this.active) return;
      if (this.locked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      } else if (this.rightDown) {
        // Fallback: arrastar botão direito se pointer lock não estiver ativo
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    };

    this._onMouseDown = (e) => {
      if (!this.active) return;
      if (e.target !== this.domElement) return;
      if (!this.locked) {
        this.requestLock();
      }
      if (e.button === 0) {
        this.leftDown = true;
        this.leftPressed = true;
      } else if (e.button === 2) {
        this.rightDown = true;
        this.rightPressed = true;
      }
    };

    this._onMouseUp = (e) => {
      if (e.button === 0) this.leftDown = false;
      if (e.button === 2) this.rightDown = false;
    };

    this._onWheel = (e) => {
      if (!this.active) return;
      this.wheelDelta += Math.sign(e.deltaY);
    };

    this._onContextMenu = (e) => {
      if (this.active) e.preventDefault();
    };

    this._onPointerLockChange = () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === this.domElement;
      if (wasLocked && !this.locked && this.active) {
        this.bus.emit('input:unlock');
      }
      this.bus.emit('input:lockchange', { locked: this.locked });
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    window.addEventListener('contextmenu', this._onContextMenu);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  requestLock() {
    try {
      if (this.domElement.requestPointerLock) {
        this.domElement.requestPointerLock();
      }
    } catch {
      // Ignora rejeição de pointer lock
    }
  }

  exitLock() {
    try {
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // Ignora
    }
  }

  isDown(code) {
    return !!this.keys[code];
  }

  consumeFrame() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    const lp = this.leftPressed;
    const rp = this.rightPressed;
    const wh = this.wheelDelta;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.leftPressed = false;
    this.rightPressed = false;
    this.wheelDelta = 0;
    return { dx, dy, leftPressed: lp, rightPressed: rp, wheel: wh };
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('contextmenu', this._onContextMenu);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }
}
