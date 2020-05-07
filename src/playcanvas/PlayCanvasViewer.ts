import pc from "playcanvas";
import Debug from "debug";
import debounce from "lodash.debounce";
import ResizeObserver from "resize-observer-polyfill";
import { OrbitCamera } from "./scripts";

const debug = Debug("playCanvasViewer");
const orbitCameraScriptName = "OrbitCamera";
const assetPrefix = "assets/playcanvas/";

type CameraEntity = pc.Entity & {
  script: pc.ScriptComponent & {
    [orbitCameraScriptName]: OrbitCamera;
  };
};

type ContainerResource = {
  model?: pc.Asset;
  textures: pc.Asset[];
  animations: pc.Asset[];
};

type PlayCanvasViewerOptions = {
  autoPlayAnimations: boolean;
};

export class PlayCanvasViewer implements TestableViewer {
  private app: pc.Application;
  private camera: CameraEntity;
  private scene?: pc.Scene;
  private entity?: pc.Entity;
  private gltfAsset?: pc.Asset;
  private modelAsset?: pc.Asset;
  private animationAssets: pc.Asset[] = [];
  private debouncedCanvasResize = debounce(() => this.resizeCanvas(), 10);
  private canvasResizeObserver = new ResizeObserver(this.debouncedCanvasResize);
  private autoPlayAnimations: boolean;
  private _initiated = false;
  private _sceneLoaded = false;
  private _modelLoaded = false;

  public constructor(
    public canvas: HTMLCanvasElement,
    { autoPlayAnimations }: PlayCanvasViewerOptions,
  ) {
    this.resizeCanvas = this.resizeCanvas.bind(this);

    this.autoPlayAnimations = autoPlayAnimations;

    this.app = this.createApp();
    this.camera = this.createCamera(this.app);

    this.canvasResizeObserver.observe(this.canvas);
  }

  public get initiated() {
    return !!this.app.graphicsDevice && this._initiated;
  }

  public get sceneLoaded() {
    return this._sceneLoaded;
  }

  public get modelLoaded() {
    return this._modelLoaded;
  }

  public get scenes(): pc.SceneFile[] {
    return this.app.scenes.list();
  }

  private resizeCanvas() {
    this.app.resizeCanvas(
      this.canvas.parentElement?.clientWidth,
      this.canvas.parentElement?.clientHeight,
    );
  }

  private createApp() {
    const existingApp = pc.Application.getApplication();
    if (existingApp) {
      debug("Destroying existing app");
      existingApp.destroy();
    }

    debug("Creating app for target", this.canvas);
    const app = new pc.Application(this.canvas, {
      assetPrefix,
      mouse: new pc.Mouse(document.body),
      keyboard: new pc.Keyboard(window),
      graphicsDeviceOptions: {
        preserveDrawingBuffer: false,
        antialias: true,
        alpha: true,
        preferWebGl2: true,
        use3dPhysics: false,
      },
    });

    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.resizeCanvas(
      this.canvas.parentElement?.clientWidth,
      this.canvas.parentElement?.clientHeight,
    );

    debug("Starting app");
    app.start();

    return app;
  }

  private createCamera(app: pc.Application) {
    debug("Creating camera");

    pc.registerScript(OrbitCamera, orbitCameraScriptName);

    const camera = new pc.Entity("camera") as CameraEntity;
    camera.addComponent("camera", {
      fov: 45.8366,
      clearColor: new pc.Color(0, 0, 0),
    });
    camera.addComponent("script");
    camera.script.create(orbitCameraScriptName);
    camera.script[orbitCameraScriptName].inertiaFactor = 0.07;
    camera.script[orbitCameraScriptName].nearClipFactor = 0.002;
    camera.script[orbitCameraScriptName].farClipFactor = 10;

    app.root.addChild(camera);

    return camera;
  }

  public destroy() {
    this.destroyModel();
    this.destroyScene();
    this.canvasResizeObserver.unobserve(this.canvas);
    this.app.destroy();
  }

  public async configure() {
    const app = this.app;

    debug("Configuring app");
    return new Promise<void>((resolve, reject) => {
      const url = "assets/playcanvas/config.json";

      app.configure(url, error => {
        if (error) {
          reject(error);
          return;
        }
        app.preload(() => {
          this._initiated = true;
          resolve();
        });
      });
    });
  }

  public async loadScene(url: string) {
    this.destroyScene();

    debug("Loading scene", url);
    return new Promise<void>((resolve, reject) => {
      this.app.scenes.loadScene(url, (error: string, scene: pc.Scene) => {
        this._sceneLoaded = true;
        if (error) {
          reject(error);
          return;
        }
        this.scene = scene;
        resolve();
      });
    });
  }

  public destroyScene() {
    debug("Destroy scene", this.scene);

    this._sceneLoaded = false;

    if (this.scene) {
      if (this.scene.root) {
        this.scene.root.destroy();
        (this.scene.root as pc.Entity | undefined) = undefined;
      }
      this.scene.destroy();
      this.scene = undefined;
    }
  }

  public destroyModel() {
    debug("Destroy model", this.entity);

    this._modelLoaded = false;

    if (this.entity) {
      this.entity.destroy();
      this.entity = undefined;
    }

    if (this.gltfAsset) {
      // If not done in this order,
      // the entity will be retained by the JS engine.
      this.app.assets.remove(this.gltfAsset);
      this.gltfAsset.unload();
      this.gltfAsset = undefined;
    }

    this.modelAsset = undefined;
    this.animationAssets = [];
  }

  private initModel() {
    debug("Init model");

    if (this.entity) {
      // Model already initialized
      return;
    }

    if (!this.gltfAsset || !this.modelAsset) {
      throw new Error("initModel called before registering resources");
    }

    // Add the loaded model to the hierarchy
    this.entity = new pc.Entity("gltf");
    this.entity.addComponent("model", {
      type: "asset",
      asset: this.modelAsset,
      castShadows: true,
      receiveShadows: true,
      shadowType: pc.SHADOW_VSM32,
    });
    this.entity.addComponent("script");
    this.app.root.addChild(this.entity);

    debug("Init animations", this.animationAssets);

    if (this.animationAssets.length > 0) {
      this.entity.addComponent("animation", {
        assets: this.animationAssets.map(asset => asset.id),
        speed: 0,
        active: false,
      });
      if (this.entity.animation && this.autoPlayAnimations) {
        this.entity.animation.speed = 1;
        this.entity.animation.play(this.animationAssets[0].name, 0);
      }
    }

    this.focusCameraOnEntity();
  }

  public focusCameraOnEntity() {
    debug("Focus on model", this.entity);

    if (this.entity) {
      this.camera.script[orbitCameraScriptName].focus(this.entity);
    }
  }

  public resetCamera(yaw?: number, pitch?: number, distance?: number) {
    this.camera.script[orbitCameraScriptName].reset(yaw, pitch, distance);
  }

  private async loadGltfAsset(url: string, fileName?: string) {
    debug("Load glTF asset", url, fileName);

    return new Promise<pc.Asset | undefined>((resolve, reject) => {
      // This is necessary because the callback of loadFromUrl is not fired when an
      // asset request that previously failed is attempted to load again.
      const timeout = setTimeout(
        () => reject("Asset request timed out"),
        10000,
      );

      const callback: pc.callbacks.LoadAsset = (err, asset) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve(asset);
        }
      };

      if (fileName) {
        // Remove asset prefix in order to prevent it from being prepended
        // to blob urls
        this.app.assets.prefix = "";
        this.app.assets.loadFromUrlAndFilename(
          url,
          fileName,
          "container",
          callback,
        );
        // Add asset prefix again
        this.app.assets.prefix = assetPrefix;
      } else {
        this.app.assets.loadFromUrl(
          pc.path.join("../..", url),
          "container",
          callback,
        );
      }
    });
  }

  private async registerGltfResources(asset: pc.Asset) {
    debug("Register glTF resources", asset.resource);

    const resource = asset.resource as ContainerResource | undefined;
    if (!resource) {
      throw new Error("Asset is empty");
    }

    this.gltfAsset = asset;
    this.modelAsset = resource.model;
    this.animationAssets = resource.animations || [];
  }

  public async loadModel(url: string, fileName?: string) {
    this.destroyModel();

    try {
      const asset = await this.loadGltfAsset(url, fileName);
      if (!asset) {
        throw new Error("Asset not found");
      }

      await this.registerGltfResources(asset);
      this.initModel();

      this._modelLoaded = true;
    } catch (e) {
      this._modelLoaded = true;
      throw e;
    }
  }
}
