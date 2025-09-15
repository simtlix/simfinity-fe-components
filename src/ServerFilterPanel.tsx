"use client";

import * as React from "react";
import { Stack, Button } from "@mui/material";
import { GridFilterPanel, useGridApiContext, type GridFilterModel } from "@mui/x-data-grid";

type ServerFilterPanelProps = {
  onApply: (model: GridFilterModel) => void;
  onClear: () => void;
};

export default function ServerFilterPanel({ onApply, onClear }: ServerFilterPanelProps) {
  const apiRef = useGridApiContext();
  return (
    <Stack sx={{ p: 1 }} spacing={1}>
      <GridFilterPanel />
      <Stack direction="row" justifyContent="flex-end" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            onClear();
            // Close the panel to give quick feedback
            apiRef.current.hideFilterPanel();
          }}
        >
          Clear
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            const model = (apiRef.current.state as { filter?: { filterModel?: GridFilterModel } })?.filter?.filterModel;
            if (model) {
              onApply(model);
            }
            apiRef.current.hideFilterPanel();
          }}
        >
          Apply
        </Button>
      </Stack>
    </Stack>
  );
}


