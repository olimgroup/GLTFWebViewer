import * as pc from "@animech-public/playcanvas";
import Debug from "debug";
import { Animation } from "../Animation";
import { InteractionHotspot as InteractionHotspotScript } from "../scripts";
import { ExtensionParser } from "./ExtensionParser";
import { ExtensionRegistry } from "./ExtensionRegistry";

const debug = Debug("InteractionHotspot");

type InteractionData = {
  image: number;
  hoveredImage?: number;
  toggledImage?: number;
  toggledHoveredImage?: number;
  animation: number;
};

type NodeExtensionData = {
  interaction: number;
};

type RootData = {
  extensions?: {
    EPIC_interaction_hotspots?: {
      interactions: InteractionData[];
    };
  };
};

type NodeInteractionDataMap = {
  node: pc.Entity;
  data: InteractionData;
};

export type InteractionHotspot = {
  node: pc.Entity;
  imageSource: string;
  hoveredImageSource?: string;
  toggledImageSource?: string;
  toggledHoveredImageSource?: string;
  animation?: Animation;
};

export class InteractionHotspotExtensionParser implements ExtensionParser {
  private _hotspots: NodeInteractionDataMap[] = [];

  public get name() {
    return "EPIC_interaction_hotspots";
  }

  public get hotspotAnimationIndices(): number[] {
    return this._hotspots
      .map(({ data }) => data.animation)
      .filter(
        (animationIndex, index, animationIndices) =>
          animationIndices.indexOf(animationIndex) === index,
      );
  }

  public getHotspotsForScene(
    scene: pc.Entity,
    animations: Animation[],
    container: pc.ContainerResource,
  ): InteractionHotspot[] {
    const { textures } = container;

    return this._hotspots
      .filter(
        hotspot =>
          textures[hotspot.data.image] &&
          animations[hotspot.data.animation] &&
          scene.findOne(node => node === hotspot.node),
      )
      .map(hotspot => {
        const image: pc.Texture = textures[hotspot.data.image].resource;
        const toggledImage: pc.Texture | undefined = hotspot.data.toggledImage
          ? textures[hotspot.data.toggledImage]?.resource
          : undefined;

        const script = hotspot.node
          .addComponent("script")
          .create(InteractionHotspotScript);

        script.size = 42;
        script.transitionDuration = 300;
        script.image = textures[hotspot.data.image];
        if (hotspot.data.hoveredImage) {
          script.hoveredImage = textures[hotspot.data.hoveredImage];
        }
        if (hotspot.data.toggledImage) {
          script.toggledImage = textures[hotspot.data.toggledImage];
        }
        if (hotspot.data.toggledHoveredImage) {
          script.toggledHoveredImage =
            textures[hotspot.data.toggledHoveredImage];
        }
        script.onToggle(a => console.log("active", a));

        return {
          node: hotspot.node,
          imageSource: image.getSource().src,
          toggledImageSource: toggledImage
            ? toggledImage.getSource().src
            : undefined,
          animation: animations.find(
            ({ index }) => index === hotspot.data.animation,
          ),
        };
      });
  }

  public register(registry: ExtensionRegistry) {
    registry.node.add(this.name, {
      postParse: this._nodePostParse.bind(this),
    });
  }

  public unregister(registry: ExtensionRegistry) {
    registry.node.remove(this.name);
  }

  public postParse() {
    // Ignore
  }

  private _nodePostParse(
    node: pc.Entity,
    extensionData: NodeExtensionData,
    rootData: RootData,
  ) {
    debug("Parse hotspot", node, extensionData, rootData);

    const hotspot =
      rootData.extensions?.EPIC_interaction_hotspots?.interactions[
        extensionData.interaction
      ];
    if (!hotspot) {
      return;
    }

    debug("Found hotspot", hotspot);

    this._hotspots.push({
      node,
      data: hotspot,
    });
  }
}
