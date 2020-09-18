import React from "react";
import { makeStyles, useRadioGroup } from "@material-ui/core";
import clsx from "clsx";
import { ReactComponent as Rotate } from "../icons/Rotate.svg";

const useStyles = makeStyles(theme => {
  const dropShadow =
    "0px 15px 25px rgba(0, 0, 0, 0.15), 0px 5px 10px rgba(0, 0, 0, 0.05)";

  return {
    root: {
      marginBottom: theme.spacing(1.5),
      marginRight: theme.spacing(1.5),
    },
    input: {
      position: "absolute",
      opacity: 0,
      pointerEvents: "none",
    },
    button: {
      position: "relative",
      width: theme.cameraPreviewWidth,
      height: theme.cameraPreviewHeight,
      borderRadius: theme.shape.borderRadius,
      backgroundColor: theme.palette.common.black,
      backgroundSize: "contain",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      boxShadow: dropShadow,
      cursor: "pointer",
      overflow: "hidden",
      transition: theme.transitions.create(["box-shadow"], {
        duration: theme.transitions.duration.short,
      }),
      "&:hover:not($buttonChecked)": {
        boxShadow: dropShadow + `, 0 0 0 2px ${theme.palette.grey[300]} inset`,
      },
    },
    buttonChecked: {
      boxShadow: dropShadow + `, 0 0 0 2px ${theme.palette.primary.main} inset`,
    },
    orbitIcon: {
      position: "absolute",
      bottom: theme.spacing(1),
      right: theme.spacing(1),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      borderRadius: "50%",
      backgroundColor: theme.palette.grey[900],
    },
  };
});

export type CameraProps = {
  orbit?: boolean;
  autoFocus?: boolean;
  checked?: boolean;
  id?: string;
  image: string;
  name?: string;
  tabIndex?: number;
  value?: string | number | string[];
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export const Camera: React.FC<CameraProps> = ({
  orbit,
  autoFocus,
  checked: checkedProp,
  id,
  image,
  name: nameProp,
  tabIndex,
  value,
  onChange,
}) => {
  const classes = useStyles();
  const radioGroup = useRadioGroup();

  const checked =
    typeof checkedProp === "undefined"
      ? radioGroup?.value === value
      : checkedProp;
  const name = typeof nameProp === "undefined" ? radioGroup?.name : nameProp;

  const _onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e);
    }
    if (radioGroup?.onChange) {
      radioGroup.onChange(e, e.target.value);
    }
  };

  return (
    <label className={classes.root}>
      <input
        autoFocus={autoFocus}
        checked={checked}
        className={classes.input}
        id={id}
        name={name}
        onChange={_onChange}
        tabIndex={tabIndex}
        type="radio"
        value={value}
      />
      <div
        className={clsx(classes.button, {
          [classes.buttonChecked]: checked,
        })}
        style={{ backgroundImage: `url(${image})` }}
      >
        {orbit && (
          <div className={classes.orbitIcon}>
            <Rotate />
          </div>
        )}
      </div>
    </label>
  );
};
