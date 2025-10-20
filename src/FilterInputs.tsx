import * as React from "react";
import { Autocomplete, Chip, TextField, Stack, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import type { GridFilterInputValueProps } from "@mui/x-data-grid";
import { useI18n } from "./lib/i18n";

export function TagsFilterInput(props: GridFilterInputValueProps) {
  const { resolveLabel } = useI18n();
  const valueArray = Array.isArray(props.item.value) ? (props.item.value as unknown[]) : [];
  return (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={valueArray as string[]}
      onChange={(_, newValue) => {
        props.applyValue({ ...props.item, value: newValue });
      }}
      renderInput={(params) => (
        <TextField 
          {...params} 
          size="small" 
          placeholder={resolveLabel(['grid.filter.values'], { entity: '' }, 'Values')}
          slotProps={{
            input: {
              startAdornment: (valueArray as string[]).map((option: string, index: number) => (
                <Chip 
                  variant="outlined" 
                  label={option} 
                  onDelete={() => {
                    const newValue = valueArray.filter((_, i) => i !== index);
                    props.applyValue({ ...props.item, value: newValue });
                  }}
                  key={`${option}-${index}`}
                  size="small"
                />
              ))
            }
          }}
        />
      )}
    />
  );
}

export function BetweenFilterInput(props: GridFilterInputValueProps & { inputType?: string }) {
  const { resolveLabel } = useI18n();
  const arr = Array.isArray(props.item.value) ? (props.item.value as unknown[]) : [null, null];
  const [minVal, maxVal] = [arr[0] ?? "", arr[1] ?? ""] as (string | number)[];
  return (
    <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
      <TextField
        size="small"
        type={props.inputType ?? "text"}
        value={minVal}
        onChange={(e) => props.applyValue({ ...props.item, value: [e.target.value, maxVal] })}
        placeholder={resolveLabel(['grid.filter.min'], { entity: '' }, 'Min')}
        fullWidth
      />
      <TextField
        size="small"
        type={props.inputType ?? "text"}
        value={maxVal}
        onChange={(e) => props.applyValue({ ...props.item, value: [minVal, e.target.value] })}
        placeholder={resolveLabel(['grid.filter.max'], { entity: '' }, 'Max')}
        fullWidth
      />
    </Stack>
  );
}

export function DateFilterInput(props: GridFilterInputValueProps & { inputType?: 'date' | 'datetime-local' }) {
  const { item, applyValue, inputType = 'datetime-local' } = props;
  const value = (item.value ?? '') as string | number;
  return (
    <TextField
      size="small"
      type={inputType}
      value={value as string}
      onChange={(e) => applyValue({ ...item, value: e.target.value })}
      fullWidth
    />
  );
}

export function StateMachineFilterInput(props: GridFilterInputValueProps & { 
  entityTypeName: string; 
  fieldName: string; 
  enumValues: string[];
  resolveLabel: (keys: string[], context?: Record<string, unknown>, fallback?: string) => string;
}) {
  const { entityTypeName, enumValues, resolveLabel } = props;
  const currentValue = props.item.value as string || "";
  const stateLabel = resolveLabel(['grid.filter.state'], { entity: '' }, 'State');

  return (
    <FormControl fullWidth size="small">
      <InputLabel>{stateLabel}</InputLabel>
      <Select
        value={currentValue}
        onChange={(e) => {
          props.applyValue({ ...props.item, value: e.target.value });
        }}
        label={stateLabel}
      >
        {enumValues.map((enumValue) => {
          const stateKey = `stateMachine.${entityTypeName.toLowerCase()}.state.${enumValue}`;
          const displayLabel = resolveLabel([stateKey], { entity: entityTypeName, state: enumValue }, enumValue);
          
          return (
            <MenuItem key={enumValue} value={enumValue}>
              {displayLabel}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
}


