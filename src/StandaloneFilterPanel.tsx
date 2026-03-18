import * as React from "react";
import {
  Box,
  Button,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { GridFilterItem, GridFilterModel, GridFilterInputValueProps } from "@mui/x-data-grid";
import { getGridNumericOperators, getGridBooleanOperators } from "@mui/x-data-grid";
import { TagsFilterInput, BetweenFilterInput, DateFilterInput, StateMachineFilterInput, TextFilterInput, BooleanFilterInput } from "./FilterInputs";
import { useI18n, type LabelContext } from "./lib/i18n";
import type SimfinityClient from "@simtlix/simfinity-js-client";

type FilterOperatorConfig = {
  label: string;
  value: string;
  InputComponent?: React.ComponentType<GridFilterInputValueProps & Record<string, unknown>>;
  InputComponentProps?: Record<string, unknown>;
};

type ResolveLabelFn = (keys: string[], ctx: LabelContext, fallback: string) => string;

type FilterColumnConfig = {
  field: string;
  headerName: string;
  filterOperators: FilterOperatorConfig[];
};

type FieldInfo = {
  isStateMachine: boolean;
  isEnum: boolean;
  enumValues: string[];
  fieldType: string | undefined;
};

function buildFilterColumnConfig(
  col: string,
  entityTypeName: string,
  listField: string,
  fieldTypeByColumn: Record<string, string>,
  getFieldInfo: (fieldName: string) => FieldInfo,
  resolveLabel: ResolveLabelFn,
  client: SimfinityClient
): FilterColumnConfig {
  const typeName = fieldTypeByColumn[col];
  const isNumeric = client.isNumericScalar(typeName);
  const isBoolean = client.isBooleanScalar(typeName);
  const isDate = client.isDateTimeScalar(typeName);
  const headerName = resolveLabel([`${entityTypeName.toLowerCase()}.${col}`], { entity: entityTypeName, field: col }, col);

  const fieldInfo = getFieldInfo(col);
  if (fieldInfo.isStateMachine && fieldInfo.isEnum) {
    return {
      field: col,
      headerName,
      filterOperators: [
        {
          label: "=",
          value: "equals",
          InputComponent: StateMachineFilterInput as React.ComponentType<GridFilterInputValueProps & Record<string, unknown>>,
          InputComponentProps: { entityTypeName, fieldName: col, enumValues: fieldInfo.enumValues, resolveLabel },
        },
      ],
    };
  }
  if (isNumeric) {
    const base = getGridNumericOperators();
    const keep = new Set(["=", "!=", ">", ">=", "<", "<=", "equals"]);
    const baseOps = base
      .filter((o) => (o.value ? keep.has(o.value) : false))
      .map((o) => ({ label: o.label ?? o.value ?? "", value: o.value ?? "equals", InputComponent: TextFilterInput, InputComponentProps: { inputType: "number" } }));
    return {
      field: col,
      headerName,
      filterOperators: [
        ...baseOps,
        {
          label: resolveLabel(["grid.filter.between"], { entity: listField }, "between"),
          value: "btw",
          InputComponent: BetweenFilterInput,
          InputComponentProps: { inputType: "number" },
        },
        {
          label: resolveLabel(["grid.filter.in"], { entity: listField }, "in"),
          value: "in",
          InputComponent: TagsFilterInput,
        },
        {
          label: resolveLabel(["grid.filter.notIn"], { entity: listField }, "not in"),
          value: "nin",
          InputComponent: TagsFilterInput,
        },
      ],
    };
  }
  if (isBoolean) {
    const boolOps = getGridBooleanOperators().map((o) => ({
      label: o.label ?? o.value ?? "",
      value: o.value ?? "equals",
      InputComponent: BooleanFilterInput,
    }));
    return {
      field: col,
      headerName,
      filterOperators: boolOps,
    };
  }
  if (isDate) {
    return {
      field: col,
      headerName,
      filterOperators: [
        { label: "=", value: "equals", InputComponent: DateFilterInput, InputComponentProps: { inputType: "datetime-local" } },
        { label: "!=", value: "!=", InputComponent: DateFilterInput, InputComponentProps: { inputType: "datetime-local" } },
        { label: ">", value: ">", InputComponent: DateFilterInput, InputComponentProps: { inputType: "datetime-local" } },
        { label: ">=", value: ">=", InputComponent: DateFilterInput, InputComponentProps: { inputType: "datetime-local" } },
        { label: "<", value: "<", InputComponent: DateFilterInput, InputComponentProps: { inputType: "datetime-local" } },
        { label: "<=", value: "<=", InputComponent: DateFilterInput, InputComponentProps: { inputType: "datetime-local" } },
        {
          label: resolveLabel(["grid.filter.between"], { entity: listField }, "between"),
          value: "btw",
          InputComponent: BetweenFilterInput,
          InputComponentProps: { inputType: "datetime-local" },
        },
      ],
    };
  }
  return {
    field: col,
    headerName,
    filterOperators: [
      {
        label: resolveLabel(["grid.filter.contains"], { entity: listField }, "contains"),
        value: "contains",
        InputComponent: TextFilterInput,
      },
      { label: "=", value: "equals", InputComponent: TextFilterInput },
      { label: "!=", value: "!=", InputComponent: TextFilterInput },
      {
        label: resolveLabel(["grid.filter.in"], { entity: listField }, "in"),
        value: "in",
        InputComponent: TagsFilterInput,
      },
      {
        label: resolveLabel(["grid.filter.notIn"], { entity: listField }, "not in"),
        value: "nin",
        InputComponent: TagsFilterInput,
      },
    ],
  };
}

export type StandaloneFilterPanelProps = {
  filterModel: GridFilterModel;
  onFilterModelChange: (model: GridFilterModel) => void;
  entityTypeName: string;
  resolvedColumns: string[];
  fieldTypeByColumn: Record<string, string>;
  getFieldInfo: (fieldName: string) => FieldInfo;
  listField: string;
  client: SimfinityClient;
  onApply: () => void;
  onClear: () => void;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function StandaloneFilterPanel({
  filterModel,
  onFilterModelChange,
  entityTypeName,
  resolvedColumns,
  fieldTypeByColumn,
  getFieldInfo,
  listField,
  client,
  onApply,
  onClear,
  open,
  onOpenChange,
}: StandaloneFilterPanelProps) {
  const { resolveLabel } = useI18n();

  const columnConfigs = React.useMemo(
    () =>
      resolvedColumns.map((col) =>
        buildFilterColumnConfig(col, entityTypeName, listField, fieldTypeByColumn, getFieldInfo, resolveLabel, client)
      ),
    [resolvedColumns, entityTypeName, listField, fieldTypeByColumn, getFieldInfo, resolveLabel, client]
  );

  const handleAddFilter = React.useCallback(() => {
    const firstCol = resolvedColumns[0];
    const firstConfig = columnConfigs.find((c) => c.field === firstCol);
    const firstOp = firstConfig?.filterOperators[0];
    const newItem: GridFilterItem = {
      id: `filter-${Date.now()}`,
      field: firstCol ?? "",
      operator: firstOp?.value ?? "equals",
      value: "",
    };
    onFilterModelChange({ items: [...filterModel.items, newItem] });
  }, [filterModel.items, resolvedColumns, columnConfigs, onFilterModelChange]);

  const handleRemoveFilter = React.useCallback(
    (index: number) => {
      const newItems = filterModel.items.filter((_, i) => i !== index);
      onFilterModelChange({ items: newItems });
    },
    [filterModel.items, onFilterModelChange]
  );

  const handleItemChange = React.useCallback(
    (index: number, updates: Partial<GridFilterItem>) => {
      const newItems = filterModel.items.map((i, idx) => (idx === index ? { ...i, ...updates } : i));
      onFilterModelChange({ items: newItems });
    },
    [filterModel.items, onFilterModelChange]
  );

  const createApplyValue = React.useCallback(
    (index: number) => (updated: GridFilterItem) => {
      handleItemChange(index, updated);
    },
    [handleItemChange]
  );

  const columnsLabel = resolveLabel(["grid.filter.columns"], { entity: listField }, "Columns");
  const operatorLabel = resolveLabel(["grid.filter.operator"], { entity: listField }, "Operator");

  const emptyMessage = resolveLabel(
    ["grid.filter.emptyMessage"],
    { entity: listField },
    "No filters applied. Click 'Add filter' to narrow down the results."
  );

  const isEmpty = filterModel.items.length === 0;

  return (
    <Collapse in={open}>
      <Box sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1, mb: 2 }}>
        <Stack spacing={2}>
          {isEmpty && (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                {emptyMessage}
              </Typography>
            </Box>
          )}
          {filterModel.items.map((item, index) => {
            const colConfig = columnConfigs.find((c) => c.field === item.field);
            const opConfig = colConfig?.filterOperators.find((o) => o.value === (item.operator ?? "equals"));
            const InputComponent = opConfig?.InputComponent ?? TextFilterInput;
            const inputProps = opConfig?.InputComponentProps ?? {};

            return (
              <Stack key={item.id ?? index} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>{columnsLabel}</InputLabel>
                  <Select
                    value={item.field || ""}
                    label={columnsLabel}
                    onChange={(e) => {
                      const newField = e.target.value;
                      const newColConfig = columnConfigs.find((c) => c.field === newField);
                      const newOp = newColConfig?.filterOperators[0];
                      handleItemChange(index, {
                        field: newField,
                        operator: newOp?.value ?? "equals",
                        value: "",
                      });
                    }}
                  >
                    {columnConfigs.map((c) => (
                      <MenuItem key={c.field} value={c.field}>
                        {c.headerName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>{operatorLabel}</InputLabel>
                  <Select
                    value={item.operator ?? "equals"}
                    label={operatorLabel}
                    onChange={(e) => handleItemChange(index, { operator: e.target.value, value: "" })}
                  >
                    {colConfig?.filterOperators.map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <InputComponent
                    {...({
                      item,
                      applyValue: createApplyValue(index),
                      ...inputProps,
                    } as GridFilterInputValueProps & Record<string, unknown>)}
                  />
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleRemoveFilter(index)}
                  aria-label="Remove filter"
                  sx={{ mt: 0.5 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            );
          })}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" variant="text" onClick={handleAddFilter}>
              {resolveLabel(["grid.filter.addFilter"], { entity: listField }, "Add filter")}
            </Button>
            {!isEmpty && (
              <>
                <Button size="small" variant="outlined" onClick={onClear}>
                  {resolveLabel(["grid.filter.clear"], { entity: listField }, "Clear")}
                </Button>
                <Button size="small" variant="contained" onClick={onApply}>
                  {resolveLabel(["grid.filter.apply"], { entity: listField }, "Apply")}
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Box>
    </Collapse>
  );
}
