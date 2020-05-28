/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="react-scripts" />

declare namespace pc {
  interface Scene {
    destroy: () => void;
  }

  type SceneFile = {
    name: string;
    url: string;
  };

  type AnimTrack = {
    name: string;
  };
}

interface TestableViewer {
  initiated: boolean;
  sceneLoaded: boolean;
  modelLoaded: boolean;
  loadModel(path: string): Promise<void>;
  loadScene(path: string): Promise<void>;
  resetCamera(yaw?: number, pitch?: number, distance?: number): void;
}

interface Window {
  /**
   * Used by e2e tests to access the current viewer instance.
   */
  viewer?: TestableViewer;

  /**
   * Used by PlayCanvas glTF parser.
   */
  DracoDecoderModule: any;
}

declare module "draco3d" {
  function createDecoderModule(): any;
  function createEncoderModule(): any;
}
