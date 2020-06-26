import * as pc from "@animech-public/playcanvas";
import Debug from "debug";
import {
  ExtensionRegistry,
  ExtensionParser,
  // HdriBackdropExtensionParser,
  InteractionHotspotExtensionParser,
  InteractionHotspot,
  VariantSet,
} from "./extensions";
import { AnimationState, Animation } from "./Animation";

const debug = Debug("PlayCanvasGltfLoader");

export type GltfSceneData = {
  root: pc.Entity;
  variantSet?: VariantSet;
  hotspots?: InteractionHotspot[];
  animations: Animation[];
};

export type GltfData = {
  asset: pc.Asset;
  scenes: GltfSceneData[];
  defaultScene: number;
};

export class PlayCanvasGltfLoader {
  private _extensionRegistry: ExtensionRegistry;

  public constructor(private _app: pc.Application) {
    this._extensionRegistry = new ExtensionRegistry();
  }

  private async _loadAsset(
    url: string,
    fileName?: string,
  ): Promise<pc.Asset | undefined> {
    debug("Load glTF asset", url, fileName);

    return new Promise<pc.Asset | undefined>((resolve, reject) => {
      const { assets } = this._app;

      const fileUrl = fileName ? url : pc.path.join("../..", url);
      const assetName = pc.path.getBasename(fileName || fileUrl);

      const options = {
        node: {
          postprocess: (nodeData: any, node: pc.Entity) => {
            if (nodeData.extensions) {
              this._extensionRegistry.node.applyAll(
                node,
                nodeData.extensions,
                {}, // TODO: really needed?
              );
            }
          },
        },
      };

      let asset = assets.getByUrl(fileUrl);
      if (!asset) {
        asset = new pc.Asset(
          assetName,
          "container",
          { url: fileUrl, filename: fileName || assetName },
          null,
          options as any,
        );
        assets.add(asset);
      }

      if (asset.resource) {
        resolve(asset);
        return;
      }

      asset.once("load", loadedAsset => resolve(loadedAsset));
      asset.once("error", err => reject(err));
      assets.load(asset);
    });
  }

  private _createAnimations(container: pc.ContainerResource): Animation[] {
    const { nodeAnimations, animations: animationAssets } = container;
    return nodeAnimations
      .filter(({ animations }) => animations.length > 0)
      .map(({ node, animations: animationIndices }) => {
        const component = node.addComponent("anim") as pc.AnimComponent;

        // Create one layer per animation asset so that the animations can be played simultaneously
        component.loadStateGraph({
          layers: animationIndices.map(index => ({
            name: (animationAssets[index].resource as pc.AnimTrack).name,
            states: [
              { name: pc.ANIM_STATE_START },
              { name: AnimationState.Loop, speed: 1, loop: true },
              { name: AnimationState.LoopReverse, speed: -1, loop: true },
              { name: AnimationState.Once, speed: 1, loop: false },
              { name: AnimationState.OnceReverse, speed: -1, loop: false },
            ],
            transitions: [],
          })),
          parameters: {},
        });

        // Create one Animation instance per layer
        return animationIndices
          .map(index => {
            const track = animationAssets[index].resource as pc.AnimTrack;
            return {
              track,
              index,
              layer: component.findAnimationLayer(track.name),
            };
          })
          .filter(({ layer }) => !!layer)
          .map(({ track, index, layer: layerOrNull }) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const layer = layerOrNull!;

            // Assign animation tracks to all states of each layer
            layer.states
              .slice(1, layer.states.length)
              .forEach(state => layer.assignAnimation(state, track));

            return new Animation(node, layer, index);
          });
      })
      .reduce<Animation[]>((acc, anims) => [...acc, ...anims], []);
  }

  private _clearExtensions() {
    this._extensionRegistry.removeAll();
  }

  private _registerExtensions(extensions: ExtensionParser[]) {
    extensions.forEach(e => e.register(this._extensionRegistry));
  }

  private _unregisterExtensions(extensions: ExtensionParser[]) {
    extensions.forEach(e => e.unregister(this._extensionRegistry));
  }

  private _applyExtensionPostParse(
    extensions: ExtensionParser[],
    container: pc.ContainerResource,
  ) {
    extensions.forEach(e => e.postParse(container));
  }

  public async load(url: string, fileName?: string): Promise<GltfData> {
    debug("Load glTF asset", url, fileName);

    const hotspotParser = new InteractionHotspotExtensionParser();
    const extensions: ExtensionParser[] = [
      // new HdriBackdropExtensionParser(),
      hotspotParser,
    ];

    this._clearExtensions();
    this._registerExtensions(extensions);

    try {
      const asset = await this._loadAsset(url, fileName);
      if (!asset) {
        throw new Error("Asset not found");
      }

      const container = asset.resource as pc.ContainerResource | undefined;
      if (!container) {
        throw new Error("Asset is empty");
      }

      const defaultScene = container.scene;
      if (!defaultScene) {
        throw new Error("Asset has no default scene");
      }

      this._applyExtensionPostParse(extensions, container);
      this._unregisterExtensions(extensions);
      debug("glTF global extensions", container.extensions);

      const animations = this._createAnimations(container);
      debug("Created animations", animations);

      const { hotspotAnimationIndices } = hotspotParser;

      return {
        asset,
        scenes: container.scenes.map<GltfSceneData>(sceneRoot => {
          const sceneAnimations = animations.filter(animation =>
            sceneRoot.findOne(node => node === animation.node),
          );
          return {
            root: sceneRoot,
            hotspots: hotspotParser.getHotspotsForScene(
              sceneRoot,
              sceneAnimations,
              container,
            ),
            animations: sceneAnimations.filter(
              animation =>
                hotspotAnimationIndices.indexOf(animation.index) === -1,
            ),
          };
        }),
        defaultScene: container.scenes.indexOf(defaultScene),
      };
    } catch (e) {
      this._unregisterExtensions(extensions);
      throw e;
    }
  }

  public unload(data: GltfData) {
    debug("Unload glTF asset", data);

    this._app.assets.remove(data.asset);
    data.asset.unload();
  }
}
