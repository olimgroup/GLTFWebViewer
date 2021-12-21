import * as pc from "@animech-public/playcanvas";
import { PreventableEvent } from "../PreventableEvent";

type KeyDownEvent = { event: PreventableEvent; key: number };
type MouseDownEvent = { event: PreventableEvent; button: number };
type MouseUpEvent = { event: PreventableEvent; button: number };
type MouseMoveEvent = {
  dy: number;
  dx: number;
  x: number;
  y: number;
};

type TagQuery = (string | TagQuery)[];

export enum FlyCameraMode {
  Lock,
  Drag,
}

export type FlyCameraModeName = keyof typeof FlyCameraMode;

export const flyCameraScriptName = "FlyCamera";

export class FlyCamera extends pc.ScriptType {
  public speed = 2;
  public fastSpeed = 5;
  public mouseSensitivity = 10;

  private _mode = FlyCameraMode.Lock;
  private _moved = false;
  private _lmbDown = false;
  private _ex = 0;
  private _ey = 0;
  private _cameraComponent!: pc.CameraComponent;
  private _initialized = false;
  private _focusEntity: pc.Entity | null = null;

  public constructor(args: { app: pc.Application; entity: pc.Entity }) {
    super(args);
  }

  /**
   * Camera mode:
   * - FreeLook allows the user to look around without moving the camera
   * - Orbital allows the user to orbit the focused entity and zoom / dolly
   */
  public get mode() {
    return this._mode;
  }

  public set mode(value: FlyCameraMode) {
    if (FlyCameraMode[value] === undefined) {
      throw new Error(`Invalid camera mode '${value}'`);
    }

    if (this._mode !== value) {
      this._mode = value;
    }
  }

  /**
   * Human readable name of the current camera mode.
   */
  public get modeName(): FlyCameraModeName {
    return FlyCameraMode[this.mode] as FlyCameraModeName;
  }

  public get focusEntity(): pc.Entity | null {
    return this._focusEntity;
  }
  public set focusEntity(value: pc.Entity | null) {
    // Sanitize in case an undefined value is passed somehow
    value = value ?? null;

    if (value !== this._focusEntity) {
      this._focusEntity?.off("destroy", this._onEntityDestroyed, this);
      this._focusEntity = value;
      this._focusEntity?.on("destroy", this._onEntityDestroyed, this);
    }
  }

  public initialize() {
    const { camera } = this.entity;
    if (!camera) {
      throw new Error("Entity is missing camera component");
    }

    this._cameraComponent = camera;

    this._setUpMouseEvents();

    this.on("destroy", () => {
      this._tearDownMouseEvents();
    });

    this._initialized = true;
  }

  public update(dt: number) {
    // Update the camera's orientation
    this.entity.setLocalEulerAngles(this._ex, this._ey, 0);

    const app = this.app;

    let speed = this.speed;
    if (app.keyboard.isPressed(pc.KEY_SHIFT)) {
      speed = this.fastSpeed;
    }

    // Update the camera's position
    if (app.keyboard.isPressed(pc.KEY_UP) || app.keyboard.isPressed(pc.KEY_W)) {
      this.entity.translateLocal(0, 0, -speed * dt);
    } else if (
      app.keyboard.isPressed(pc.KEY_DOWN) ||
      app.keyboard.isPressed(pc.KEY_S)
    ) {
      this.entity.translateLocal(0, 0, speed * dt);
    }

    if (
      app.keyboard.isPressed(pc.KEY_LEFT) ||
      app.keyboard.isPressed(pc.KEY_A)
    ) {
      this.entity.translateLocal(-speed * dt, 0, 0);
    } else if (
      app.keyboard.isPressed(pc.KEY_RIGHT) ||
      app.keyboard.isPressed(pc.KEY_D)
    ) {
      this.entity.translateLocal(speed * dt, 0, 0);
    }

    const clamp = (num: number, a: number, b: number) =>
      Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));
    const posX = this.entity.getPosition().x;
    clamp(posX, -17.0, -5.0);
    const posY = this.entity.getPosition().y;
    clamp(posY, 11.0, 18.0);
    const posZ = this.entity.getPosition().z;
    clamp(posZ, -5.5, 3.0);
  }

  private _onMouseDown(event: MouseDownEvent) {
    if (event.button === pc.MOUSEBUTTON_LEFT) {
      this._lmbDown = true;

      // When the mouse button is clicked try and capture the pointer
      if (!this.mode && !pc.Mouse.isPointerLocked()) {
        this.app.mouse.enablePointerLock();
      }
    }
  }

  private _onMouseUp(event: MouseUpEvent) {
    if (event.button === pc.MOUSEBUTTON_LEFT) {
      this._lmbDown = false;
    }
  }

  private _onMouseMove(event: MouseMoveEvent) {
    if (!this._lmbDown) {
      return;
    }

    // Update the current Euler angles, clamp the pitch.
    if (!this._moved) {
      // first move event can be very large
      this._moved = true;
      return;
    }
    this._ex -= event.dy / this.mouseSensitivity;
    this._ex = pc.math.clamp(this._ex, -90, 90);
    this._ey -= event.dx / this.mouseSensitivity;
  }

  private _setUpMouseEvents() {
    // Disabling the context menu stops the browser displaying a menu when
    // you right-click the page
    this.app.mouse.disableContextMenu();
    this.app.mouse.on(pc.EVENT_MOUSEDOWN, this._onMouseDown, this);
    this.app.mouse.on(pc.EVENT_MOUSEUP, this._onMouseUp, this);
    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this._onMouseMove, this);
  }

  private _tearDownMouseEvents() {
    this.app.mouse.off(pc.EVENT_MOUSEDOWN, this._onMouseDown, this);
    this.app.mouse.off(pc.EVENT_MOUSEUP, this._onMouseUp, this);
    this.app.mouse.off(pc.EVENT_MOUSEMOVE, this._onMouseMove, this);
  }

  private _onEntityDestroyed(entity: pc.Entity) {
    if (this._focusEntity === entity) {
      this._focusEntity = null;
    }
  }
}
