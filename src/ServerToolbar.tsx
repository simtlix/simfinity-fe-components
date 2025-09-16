import * as React from "react";
import { Stack, Button } from "@mui/material";
import type { GridFilterModel } from "@mui/x-data-grid";

type ServerToolbarProps = {
  filterModel: GridFilterModel; // reserved for future enhancements
  onFilterModelChange: (model: GridFilterModel) => void; // reserved for inline controls
  onApply: () => void;
  onClear: () => void;
  onOpenFilter: () => void;
};

export default function ServerToolbar({ onApply, onClear, onOpenFilter }: ServerToolbarProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ px: 1, py: 0.5, justifyContent: "space-between", alignItems: "center" }}>
      <Button variant="text" size="small" onClick={() => {
        onOpenFilter();
      }}>Filter</Button>
      <Button variant="outlined" size="small" onClick={onClear}>Clear</Button>
      <Button variant="contained" size="small" onClick={onApply}>Apply</Button>
    </Stack>
  );
}


