import React, { useEffect, useRef, useState, useCallback } from "react";
import { observer } from "mobx-react-lite";
import Debug from "debug";
import {
  Backdrop,
  CircularProgress,
  makeStyles,
  useTheme,
  Card,
} from "@material-ui/core";
import clsx from "clsx";
import { PlayCanvasViewer } from "../playcanvas";
import { useStores } from "../stores";
import {
  useAsyncWithLoadingAndErrorHandling,
  usePreventableCameraInteractions,
  useGltfDrop,
} from "../hooks";
import { MessageBox } from "../components";

const debug = Debug("Viewer");

const useStyles = makeStyles(theme => ({
  root: {
    // Extra height and width adjusts for rounding issue when
    // centering canvas vertically and horizontally
    height: "calc(100% + 4px)",
    width: "calc(100% + 4px)",
    outline: 0,
  },
  canvasWrapper: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translateY(-50%) translateX(-50%)",
  },
  buttons: {
    position: "absolute",
    top: "5%",
    left: "5%",
    //    transform: "translateY(-50%) translateX(-50%)",
  },
  button: {
    marginRight: 10,
  },
  canvas: {
    outline: 0,
  },
  backdrop: {
    position: "absolute",
    zIndex: 3,
    color: theme.palette.common.white,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    transition:
      theme.transitions.create(["opacity", "background-color"], {
        duration: theme.transitions.duration.shortest,
      }) + " !important",
  },
  backdropTransparent: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  backdropBorder: {
    border: `3px solid ${theme.palette.primary.main}`,
  },
  messageBox: {
    maxWidth: 320,
  },
}));

export type ViewerProps = {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
};

export const Viewer: React.FC<ViewerProps> = observer(
  ({
    isError = false,
    isEmpty = false,
    isLoading: globalIsLoading = false,
  }) => {
    const classes = useStyles();
    const theme = useTheme();
    const { gltfStore, settingsStore } = useStores();
    const { gltf, setGltf, setSceneHierarchy, camera } = gltfStore;
    const { enableDragAndDrop, showUI } = settingsStore;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [viewer, setViewer] = useState<PlayCanvasViewer>();

    const onDropGltf = useCallback(setGltf, [setGltf]);
    const [
      isDragActive,
      hasDropError,
      setHasDropError,
      getRootProps,
    ] = useGltfDrop(onDropGltf, enableDragAndDrop);

    const [
      localIsLoading,
      hasLoadError,
      runAsync,
    ] = useAsyncWithLoadingAndErrorHandling();

    const isLoading = globalIsLoading || localIsLoading;
    const hasError = hasLoadError || hasDropError || isError;
    const showBackdrop =
      showUI && (isLoading || isDragActive || hasError || isEmpty);

    const [setPreventInteraction] = usePreventableCameraInteractions(
      showBackdrop,
    );

    // PlayCanvasViewer: Instantiate and configure
    useEffect(() => {
      if (!canvasRef.current) {
        return;
      }

      debug("Create viewer");
      const viewer = new PlayCanvasViewer(canvasRef.current, {
        width: theme.cameraPreviewWidth,
        height: theme.cameraPreviewHeight,
      });

      runAsync(async () => {
        debug("Configure viewer start");
        await viewer.configure();
        setViewer(viewer);
        window.viewer = viewer;
        debug("Configure viewer end");
      });

      return () => {
        debug("Destroy viewer");
        window.viewer = undefined;
        viewer.destroy();
      };
    }, [runAsync, theme.cameraPreviewHeight, theme.cameraPreviewWidth]);

    // PlayCanvasViewer: Load glTF
    // GltfStore: Update scene hierarchy list
    useEffect(() => {
      if (!viewer?.initiated || !gltf) {
        return;
      }

      runAsync(async () => {
        debug("Load glTF start", gltf.filePath);
        setSceneHierarchy();
        await viewer.loadGltf(gltf.filePath, gltf.blobFileName);
        viewer.initAnimations();
        viewer.setActiveCamera(0);
        await viewer.initCameraPreviews();
        debug("Load glTF end", gltf.filePath);

        if (viewer.activeSceneHierarchy) {
          debug("Set scene hierachy", viewer.activeSceneHierarchy);
          setSceneHierarchy(viewer.activeSceneHierarchy);
        }
      });

      return () => {
        debug("Destroy glTF");
        viewer.destroyGltf();

        debug("Unset scene hierachy");
        setSceneHierarchy();
      };
    }, [runAsync, viewer, gltf, setSceneHierarchy]);

    // PlayCanvasViewer: Set active camera
    useEffect(() => {
      if (!viewer?.initiated || !camera) {
        return;
      }
      debug("Set active camera", camera);
      viewer.setActiveCamera(camera.id);
    }, [viewer, camera]);

    // Reset error state
    useEffect(() => {
      debug("Reset drop error state");
      setHasDropError(false);
    }, [gltf, setHasDropError, viewer]);

    // Prevent camera interactions
    useEffect(() => {
      debug("Prevent camera interaction", showBackdrop);
      setPreventInteraction(showBackdrop);
    }, [showBackdrop, setPreventInteraction]);

    function SwapMaterial() {
      const root = viewer?.gltfScene?.root;

      const table = root?.findByName(
        "DiningRoomTable_StaticMeshComponent0",
      ) as pc.Entity;
      const model = table?.model;
      const material0 = model?.meshInstances[0].material as pc.StandardMaterial;
      const material1 = model?.meshInstances[1].material as pc.StandardMaterial;

      const temp = material1.diffuseMap;
      material1.diffuseMap = material0.diffuseMap;
      material0.diffuseMap = temp;
      material0.update();
      material1.update();
    }

    function VisibleSwitch() {
      const root = viewer?.gltfScene?.root;

      const arr = [
        "Book2_StaticMeshComponent0",
        "Book3_StaticMeshComponent0",
        "Book4_StaticMeshComponent0",
        "Book12_StaticMeshComponent0",
        "Bowl2_StaticMeshComponent0",
        "CoffeeTable1_StaticMeshComponent0",
        "CoffeeTable2_StaticMeshComponent0",
        "Vase1_StaticMeshComponent0",
        "Vase2_StaticMeshComponent0",
        "LivingRoomRug_StaticMeshComponent0",
      ];

      arr.forEach(name => {
        const obj = root?.findByName(name) as pc.Entity;
        obj.enabled = !obj.enabled;
      });
    }

    function CloneObject() {
      const root = viewer?.gltfScene?.root;
      const table = root?.findByName(
        "LivingRoomChair_StaticMeshComponent0",
      ) as pc.Entity;
      const cloneObject = table.clone();
      root?.addChild(cloneObject);
      cloneObject.name = "NewChair";
      cloneObject.setLocalPosition(table.getLocalPosition());
      cloneObject.translateLocal(0, 0, 1.0);
    }

    function RotateObject() {
      const root = viewer?.gltfScene?.root;
      const table = root?.findByName("NewChair") as pc.Entity;
      setInterval(() => {
        table.rotate(0, 1, 0);
      }, 10);
    }

    let value = 0.0;
    function TranslateObject() {
      const root = viewer?.gltfScene?.root;
      const obj = root?.findByName("Pillow_StaticMeshComponent0") as pc.Entity;
      const pos = obj.getLocalPosition();
      setInterval(() => {
        value += 0.02;
        obj.setLocalPosition(pos.x, pos.y + Math.sin(value) * 0.002, pos.z);
      }, 5);
    }

    return (
      <div className={classes.root} {...getRootProps()}>
        <div className={classes.canvasWrapper}>
          <div className={classes.buttons}>
            <button
              className={classes.button}
              type="button"
              onClick={SwapMaterial}
            >
              swap material
            </button>
            <button
              className={classes.button}
              type="button"
              onClick={CloneObject}
            >
              clone object
            </button>
            <button
              className={classes.button}
              type="button"
              onClick={TranslateObject}
            >
              translate object
            </button>
            <button
              className={classes.button}
              type="button"
              onClick={RotateObject}
            >
              rotate object
            </button>
            <button
              className={classes.button}
              type="button"
              onClick={VisibleSwitch}
            >
              visible
            </button>
          </div>

          <canvas className={classes.canvas} ref={canvasRef} />
        </div>
        <Backdrop
          className={clsx(classes.backdrop, {
            [classes.backdropTransparent]: !isLoading,
            [classes.backdropBorder]: isDragActive,
          })}
          open={showBackdrop}
        >
          {isLoading ? (
            <CircularProgress />
          ) : hasError ? (
            <Card className={classes.messageBox}>
              <MessageBox
                icon="error"
                overline="Oops!"
                title="Unexpected issue"
              >
                We tried our best but something went wrong when loading{" "}
                {isError ? "assets" : "the asset"}. Check console for more
                details.
              </MessageBox>
            </Card>
          ) : isEmpty || isDragActive ? (
            <Card className={classes.messageBox}>
              <MessageBox icon="dragdrop" title="Drop glTF file here">
                Drop a .gltf or .glb file with accompanying assets to view them.
              </MessageBox>
            </Card>
          ) : null}
        </Backdrop>
      </div>
    );
  },
);
