import * as React from "react";
import { Stack, Button } from "@mui/material";
import { GridFilterPanel, useGridApiContext, type GridFilterModel } from "@mui/x-data-grid";
import { useI18n } from "./lib/i18n";

type ServerFilterPanelProps = {
  onApply: (model: GridFilterModel) => void;
  onClear: () => void;
};

export default function ServerFilterPanel({ onApply, onClear }: ServerFilterPanelProps) {
  const apiRef = useGridApiContext();
  const { resolveLabel } = useI18n();
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
          {resolveLabel(['grid.filter.clear'], { entity: '' }, 'Clear')}
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
          {resolveLabel(['grid.filter.apply'], { entity: '' }, 'Apply')}
        </Button>
      </Stack>
    </Stack>
  );
}


