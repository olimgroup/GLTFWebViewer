import * as pc from "@animech-public/playcanvas";
import Debug from "debug";
import { FlyCamera, FlyCameraMode } from "../scripts/FlyCamera";
import { ExtensionParser } from "./ExtensionParser";
import { ExtensionRegistry } from "./ExtensionRegistry";

const debug = Debug("FlyCameraControl");

type NodeExtensionData = {
  mode: "Lock" | "Drag";
  target: number;
  speed: number;
  fastSpeed: number;
  mouseSensitivity: number;
};

type FlyCameraScriptFocusMap = {
  script: FlyCamera;
  node: number;
};

export class CameraControlExtensionParser implements ExtensionParser {
  private _focusNodes: FlyCameraScriptFocusMap[] = [];

  public get name() {
    return "EPIC_camera_controls";
  }

  public register(registry: ExtensionRegistry) {
    registry.camera.add(this.name, {
      postParse: this._cameraPostParse.bind(this),
    });
  }

  public unregister(registry: ExtensionRegistry) {
    registry.camera.remove(this.name);
  }

  public postParse(container: pc.ContainerResource) {
    debug("Post parse camera control");

    this._focusNodes.forEach(
      ({ script, node: nodeIndex }) =>
        (script.focusEntity = container.nodes[nodeIndex] ?? null),
    );
  }

  private _cameraPostParse(
    camera: pc.CameraComponent,
    data: NodeExtensionData,
  ) {
    debug("Parse camera control", camera, data);

    const missingProperties = this._getMissingProperties(data, [
      "mode",
      "speed",
      "fastSpeed",
      "mouseSensitivity",
    ]);

    if (missingProperties.length > 0) {
      missingProperties.forEach(key =>
        debug(
          `Property '${key}' for camera control '${camera.entity.name}' is missing`,
        ),
      );
      return;
    }

    const cameraMode = this._parseOrbitCameraMode(data.mode);
    if (cameraMode === null) {
      debug(
        `Camera mode '${data.mode}' for camera control '${camera.entity.name}' is invalid`,
      );
      return;
    }

    const script = (
      camera.entity.script ?? camera.entity.addComponent("script")
    ).create(FlyCamera, {
      enabled: false, // This is enabled later for the active camera
    });

    script.mode = cameraMode;
    script.speed = 2;
    script.fastSpeed = 5;
    script.mouseSensitivity = 10;

    debug("Added orbit camera script", camera, script);

    this._focusNodes.push({
      script: script,
      node: data.target,
    });
  }

  private _getMissingProperties<T extends {}>(
    obj: T,
    properties: (keyof T)[],
  ): (keyof T)[] {
    return properties.filter(key => obj[key] === undefined);
  }

  private _parseOrbitCameraMode(
    cameraControlMode?: string,
  ): FlyCameraMode | null {
    if (!cameraControlMode || cameraControlMode.length < 2) {
      return null;
    }

    const modeName = this._capitalizeFirstLetter(cameraControlMode);
    return FlyCameraMode[modeName as keyof typeof FlyCameraMode] ?? null;
  }

  private _capitalizeFirstLetter(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
