import React, { useEffect, useState } from "react";
import Fuse, { FuseOptions } from "fuse.js";
import {
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { observer } from "mobx-react-lite";
import { useStores } from "../stores";
import { GltfFile } from "../lib/GltfFile";
import { useAsyncWithLoadingAndErrorHandling } from "../hooks";
import { SearchField } from "./SearchField";

const useStyles = makeStyles(theme => ({
  list: {
    maxHeight: "100%",
    overflow: "auto",
  },
  spinner: {
    paddingTop: theme.spacing(2),
    textAlign: "center",
  },
  error: {
    margin: theme.spacing(2),
  },
}));

const fuseOptions: FuseOptions<GltfFile> = {
  shouldSort: true,
  includeScore: false,
  threshold: 0.6,
  location: 0,
  distance: 100,
  minMatchCharLength: 0,
  keys: ["name"],
};

export const ModelList: React.FC = observer(() => {
  const classes = useStyles();
  const { modelStore } = useStores();
  const { model: selectedModel, models, setModel, fetchModels } = modelStore;
  const [isLoading, isError, runAsync] = useAsyncWithLoadingAndErrorHandling();
  const [searchTerm, setSearchTerm] = useState("");
  const [fuse, setFuse] = useState<Fuse<GltfFile, typeof fuseOptions>>();
  const [list, setList] = useState(models);

  useEffect(() => {
    runAsync(async () => {
      await fetchModels();
    });
  }, [fetchModels, runAsync]);

  useEffect(() => {
    setFuse(models.length > 0 ? new Fuse(models, fuseOptions) : undefined);
  }, [models]);

  useEffect(() => {
    setList(
      searchTerm.length === 0
        ? models
        : fuse
        ? (fuse.search(searchTerm) as Fuse.FuseResultWithScore<GltfFile>[]).map(
            result => result.item,
          )
        : [],
    );
  }, [fuse, searchTerm, models]);

  return (
    <>
      <SearchField term={searchTerm} onChange={setSearchTerm} />
      <Divider />
      <List id="model-list" className={classes.list}>
        {isLoading ? (
          <div className={classes.spinner}>
            <CircularProgress />
          </div>
        ) : isError ? (
          <Typography
            className={classes.error}
            variant="body2"
            color="textSecondary"
          >
            Something went wrong when loading models. Check console for more
            details.
          </Typography>
        ) : (
          list.map(model => (
            <ListItem
              onClick={() => setModel(model)}
              button
              key={model.path}
              selected={selectedModel && model.path === selectedModel.path}
            >
              <ListItemText primary={model.name} secondary={model.type} />
            </ListItem>
          ))
        )}
      </List>
    </>
  );
});
