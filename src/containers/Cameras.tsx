import React from "react";
import { observer } from "mobx-react-lite";
import { RadioGroup, useTheme } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { useStores } from "../stores";
import { Camera, Appear } from "../components";

const useStyles = makeStyles(theme => ({
  root: {
    zIndex: 2,
    position: "absolute",
    marginBottom: -theme.spacing(1.5), // Compensates for Camera margin
    bottom: theme.spacing(2),
    left: theme.spacing(2),
    display: "flex",
    flexDirection: "row",
  },
  label: {
    margin: theme.spacing(2, 2, 0.5, 2),
  },
}));

export const Cameras: React.FC = observer(() => {
  const { gltfStore } = useStores();
  const theme = useTheme();
  const { cameras, camera, setCamera } = gltfStore;
  const classes = useStyles();

  if (cameras.length < 2) {
    return null;
  }

  return (
    <RadioGroup
      className={classes.root}
      aria-label="camera"
      data-testid="camera-select"
      name="camera-select"
      value={camera !== undefined ? camera.id.toString() : ""}
      onChange={e => {
        setCamera(cameras.find(c => c.id === parseInt(e.target.value, 10)));
      }}
    >
      {cameras.map((camera, index) => (
        <Camera
          key={camera.id}
          value={camera.id.toString()}
          image={camera.previewSource}
          type={camera.type}
          appear={
            <Appear delay={index * theme.listAnimationDelay} direction="up" />
          }
        />
      ))}
    </RadioGroup>
  );
});
