import React, { useState, useEffect } from "react";
import clsx from "clsx";
import CssBaseline from "@material-ui/core/CssBaseline";
import { Hidden, Tabs, Tab, makeStyles, Divider } from "@material-ui/core";
import { observer } from "mobx-react-lite";
import { Sidebar, FpsMonitor, SidebarToggle, GltfMeta } from "../components";
import { useStores } from "../stores";
import { useAsyncWithLoadingAndErrorHandling } from "../hooks";
import { Viewer } from "./Viewer";
import { Settings } from "./Settings";
import { Gltf } from "./Gltf";

const urlParams = new URLSearchParams(window.location.search);
const showUI = !urlParams.get("hideUI");

const useStyles = makeStyles(theme => ({
  "@global": {
    html: {
      height: "100%",
    },
    body: {
      height: "100%",
      margin: "0",
      overflow: "hidden",
    },
    "#root": {
      height: "100%",
    },
  },
  root: {
    display: "flex",
    height: "100%",
  },
  viewport: {
    position: "relative",
    flexGrow: 1,
    height: "100%",
    backgroundColor: theme.palette.background.default,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  viewportFullscreen: {
    marginRight: -1 * theme.sidebarWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
}));

type ActiveTab = "gltf" | "settings";

export const Root: React.FC = observer(() => {
  const classes = useStyles();
  const { gltfStore } = useStores();
  const { gltf, fetchGltfs } = gltfStore;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("gltf");
  const [isLoading, isError, runAsync] = useAsyncWithLoadingAndErrorHandling();

  useEffect(() => {
    runAsync(async () => {
      await fetchGltfs();
    });
  }, [fetchGltfs, runAsync]);

  return (
    <div className={classes.root}>
      <CssBaseline />
      <main
        className={clsx(classes.viewport, {
          [classes.viewportFullscreen]: !isSidebarOpen,
        })}
      >
        <Viewer />
        {showUI && (
          <SidebarToggle isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        )}
        {showUI && gltf && <GltfMeta gltf={gltf} />}
      </main>
      {showUI && (
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}>
          <Tabs
            value={activeTab}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
            onChange={(_, value) => setActiveTab(value)}
          >
            <Tab label="glTF" value="gltf" />
            <Tab label="Settings" value="settings" />
          </Tabs>
          <Divider />
          {activeTab === "settings" && <Settings />}
          {activeTab === "gltf" && (
            <Gltf isLoading={isLoading} isError={isError} />
          )}
        </Sidebar>
      )}
      {showUI && (
        <Hidden xsDown>
          <FpsMonitor />
        </Hidden>
      )}
    </div>
  );
});
