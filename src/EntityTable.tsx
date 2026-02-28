import * as React from "react";
import { Box, CircularProgress, Paper, Typography, Stack, IconButton, Tooltip, TablePagination } from "@mui/material";
import { DataGrid, type GridColDef, type GridPaginationModel, type GridFilterModel, type GridFilterOperator, getGridNumericOperators, getGridBooleanOperators, GridFilterInputValue } from "@mui/x-data-grid";
import ServerToolbar from "./ServerToolbar";
import ServerFilterPanel from "./ServerFilterPanel";
import { TagsFilterInput, BetweenFilterInput, DateFilterInput, StateMachineFilterInput } from "./FilterInputs";
import type { ValueResolver } from "./lib/introspection";
import { resolveColumnRenderer } from "./lib/columnRenderers";
import { useI18n } from "./lib/i18n";
import { useSimfinityClient, useFind, buildValueResolvers, type FilterItem } from "./lib/simfinityClient";
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleIcon from '@mui/icons-material/AddCircle';

type EntityTableProps = {
  listField: string;
  onNavigate?: (path: string) => void;
  getSearchParams?: () => URLSearchParams;
  onSearchParamsChange?: (params: URLSearchParams) => void;
};

const OPERATOR_MAP: Record<string, string> = {
  contains: 'LIKE', startsWith: 'LIKE', endsWith: 'LIKE', equals: 'EQ', '=': 'EQ', is: 'EQ',
  '!=': 'NE', not: 'NE', greaterThan: 'GT', '>': 'GT', greaterThanOrEqual: 'GTE', '>=': 'GTE',
  lessThan: 'LT', '<': 'LT', lessThanOrEqual: 'LTE', '<=': 'LTE',
  isAnyOf: 'IN', in: 'IN', nin: 'NIN', btw: 'BTW',
};

function gridFilterModelToFilterItems(model: GridFilterModel): FilterItem[] {
  if (!model?.items?.length) return [];
  const items: FilterItem[] = [];
  for (const item of model.items) {
    if (!item.field || item.value == null || item.value === '') continue;
    const operator = OPERATOR_MAP[item.operator ?? 'equals'] ?? 'EQ';
    items.push({ field: String(item.field), operator, value: item.value });
  }
  return items;
}

type Row = Record<string, unknown>;

function EntityTable({
  listField,
  onNavigate,
  getSearchParams,
  onSearchParamsChange,
}: EntityTableProps) {
  const client = useSimfinityClient();
  const { resolveLabel, locale } = useI18n();

  const entityTypeName = React.useMemo(
    () => client.getTypeNameForQuery(listField) ?? listField,
    [client, listField]
  );

  const { valueResolvers, selectionMeta } = React.useMemo(
    () => buildValueResolvers(client, entityTypeName),
    [client, entityTypeName]
  );

  const { selection, columns: resolvedColumns, sortFieldByColumn, fieldTypeByColumn } = selectionMeta;

  const getFieldInfo = React.useCallback((fieldName: string) => {
    const isStateMachine = client.isStateMachineField(entityTypeName, fieldName);
    const fType = fieldTypeByColumn[fieldName];
    const enumValues = fType ? client.getEnumValues(fType) : [];
    const isEnum = enumValues.length > 0;

    return { isStateMachine, isEnum, enumValues, fieldType: fType };
  }, [client, entityTypeName, fieldTypeByColumn]);

  const renderStateMachineValue = React.useCallback((value: unknown, etn: string) => {
    if (value == null) return "";
    const stateKey = `stateMachine.${etn.toLowerCase()}.state.${value}`;
    return resolveLabel([stateKey], { entity: etn }, String(value));
  }, [resolveLabel]);

  const searchParams = React.useMemo(() => {
    if (getSearchParams) return getSearchParams();
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search);
    return new URLSearchParams();
  }, [getSearchParams]);

  const searchParamsString = React.useMemo(() => searchParams.toString(), [searchParams]);

  const navigate = React.useCallback((path: string) => {
    if (onNavigate) { onNavigate(path); }
    else if (typeof window !== 'undefined') { window.location.href = path; }
  }, [onNavigate]);

  const getEntityName = (pluralName: string, form: 'single' | 'plural'): string => {
    const baseName = entityTypeName.toLowerCase();
    return `entity.${baseName}.${form}`;
  };

  const [page, setPage] = React.useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = React.useState<number>(10);
  const [sortModel, setSortModel] = React.useState<{ field: string; sort: 'asc' | 'desc' }[]>([]);
  const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });
  const [pendingFilterModel, setPendingFilterModel] = React.useState<GridFilterModel>({ items: [] });

  const filterItems = React.useMemo(() => gridFilterModelToFilterItems(filterModel), [filterModel]);

  const sortTerms = React.useMemo(
    () => sortModel.map(s => ({ field: s.field, order: (s.sort === 'asc' ? 'ASC' : 'DESC') as 'ASC' | 'DESC' })),
    [sortModel]
  );

  const { data: rows, loading: loadingData, error: errorObj, totalCount } = useFind<Row>(
    entityTypeName,
    {
      page,
      size: rowsPerPage,
      sort: sortTerms,
      filters: filterItems,
      fields: selection,
      sortFieldByColumn,
      fieldTypeByColumn,
    }
  );

  const errorData = errorObj?.message ?? null;

  const updateURL = React.useCallback((updates: {
    page?: number | null;
    size?: number | null;
    sort?: { field: string; sort: 'asc' | 'desc' }[] | null;
    filter?: GridFilterModel | null;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.page !== undefined) {
      if (updates.page === null || updates.page === 0) params.delete('page');
      else params.set('page', String(updates.page + 1));
    }
    if (updates.size !== undefined) {
      if (updates.size === null || updates.size === 10) params.delete('size');
      else params.set('size', String(updates.size));
    }
    if (updates.sort !== undefined) {
      if (updates.sort === null || updates.sort.length === 0) params.delete('sort');
      else params.set('sort', updates.sort.map(s => `${s.field}:${s.sort}`).join(','));
    }
    if (updates.filter !== undefined) {
      if (updates.filter === null || updates.filter.items.length === 0) params.delete('filter');
      else params.set('filter', JSON.stringify(updates.filter));
    }

    if (onSearchParamsChange) { onSearchParamsChange(params); }
    else if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [searchParamsString, onSearchParamsChange]);

  React.useEffect(() => {
    const pageParam = searchParams.get('page');
    const sizeParam = searchParams.get('size');
    const sortParam = searchParams.get('sort');
    const filterParam = searchParams.get('filter');

    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 0) setPage(pageNum - 1);
    }
    if (sizeParam) {
      const sizeNum = parseInt(sizeParam, 10);
      if (!isNaN(sizeNum) && [5, 10, 25, 50].includes(sizeNum)) setRowsPerPage(sizeNum);
    }
    if (sortParam) {
      try {
        const sortItems = sortParam.split(',').map(item => {
          const [field, sort] = item.split(':');
          return { field, sort: sort as 'asc' | 'desc' };
        });
        setSortModel(sortItems);
      } catch { /* skip invalid */ }
    }
    if (filterParam) {
      try {
        const fm = JSON.parse(filterParam);
        setFilterModel(fm);
        setPendingFilterModel(fm);
      } catch { /* skip invalid */ }
    }
  }, [searchParamsString]);

  React.useEffect(() => { updateURL({ page, size: rowsPerPage }); }, [page, rowsPerPage, updateURL]);
  React.useEffect(() => { updateURL({ sort: sortModel }); }, [sortModel, updateURL]);
  React.useEffect(() => { updateURL({ filter: filterModel }); }, [filterModel, updateURL]);

  const tableTitle = resolveLabel([getEntityName(listField, 'plural')], { entity: listField }, listField);

  type GridRow = Row & { __rid: string };
  const gridColumns: GridColDef<GridRow>[] = React.useMemo(() => {
    const actionColumn: GridColDef<GridRow> = {
      field: 'actions',
      headerName: resolveLabel(["actions.column"], { entity: listField }, "Actions"),
      sortable: false,
      filterable: false,
      width: 100,
      renderCell: (params) => {
        const row = params.row as GridRow;
        const entityId = String(row.id);
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={resolveLabel(["actions.view"], { entity: listField }, "View")}>
              <IconButton size="small" onClick={() => navigate(`/entities/${listField}/${entityId}/view`)} color="primary">
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={resolveLabel(["actions.edit"], { entity: listField }, "Edit")}>
              <IconButton size="small" onClick={() => navigate(`/entities/${listField}/${entityId}/edit`)} color="primary">
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    };

    const dataColumns = resolvedColumns.map((col) => {
      const header = resolveLabel([`${entityTypeName.toLowerCase()}.${col}`], { entity: entityTypeName, field: col }, col);
      const typeName = fieldTypeByColumn[col];
      const isNumeric = client.isNumericScalar(typeName);
      const isBoolean = client.isBooleanScalar(typeName);
      const isDate = client.isDateTimeScalar(typeName);
      const def: GridColDef<GridRow> = {
        field: col,
        headerName: header,
        flex: 1,
        minWidth: 140,
        type: isNumeric ? 'number' : isBoolean ? 'boolean' : isDate ? 'dateTime' : 'string',
        headerAlign: 'left',
        align: 'left',
        filterOperators: (() => {
          const fieldInfo = getFieldInfo(col);
          if (fieldInfo.isStateMachine && fieldInfo.isEnum) {
            return [
              {
                label: '=', value: 'equals',
                getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'],
                InputComponent: StateMachineFilterInput,
                InputComponentProps: { entityTypeName, fieldName: col, enumValues: fieldInfo.enumValues, resolveLabel },
              } as unknown as GridFilterOperator,
            ];
          }
          if (isNumeric) {
            const base = getGridNumericOperators();
            const keep = new Set(['=', '!=', '>', '>=', '<', '<=', 'equals']);
            return [
              ...base.filter((o) => (o.value ? keep.has(o.value) : false)),
              { label: resolveLabel(['grid.filter.between'], { entity: listField }, 'between'), value: 'btw', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: BetweenFilterInput, InputComponentProps: { inputType: 'number' } } as unknown as GridFilterOperator,
              { label: resolveLabel(['grid.filter.in'], { entity: listField }, 'in'), value: 'in', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: TagsFilterInput } as unknown as GridFilterOperator,
              { label: resolveLabel(['grid.filter.notIn'], { entity: listField }, 'not in'), value: 'nin', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: TagsFilterInput } as unknown as GridFilterOperator,
            ];
          }
          if (isBoolean) return getGridBooleanOperators();
          if (isDate) {
            return [
              { label: '=', value: 'equals', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: '!=', value: '!=', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: '>', value: '>', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: '>=', value: '>=', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: '<', value: '<', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: '<=', value: '<=', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: resolveLabel(['grid.filter.between'], { entity: listField }, 'between'), value: 'btw', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: BetweenFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
            ];
          }
          return [
            { label: resolveLabel(['grid.filter.contains'], { entity: listField }, 'contains'), value: 'contains', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: GridFilterInputValue } as unknown as GridFilterOperator,
            { label: '=', value: 'equals', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: GridFilterInputValue } as unknown as GridFilterOperator,
            { label: '!=', value: '!=', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: GridFilterInputValue } as unknown as GridFilterOperator,
            { label: resolveLabel(['grid.filter.in'], { entity: listField }, 'in'), value: 'in', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: TagsFilterInput } as unknown as GridFilterOperator,
            { label: resolveLabel(['grid.filter.notIn'], { entity: listField }, 'not in'), value: 'nin', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: TagsFilterInput } as unknown as GridFilterOperator,
          ];
        })(),
        valueGetter: isDate
          ? (params: { value: unknown }) => {
              const raw = params.value as unknown;
              if (raw == null) return null;
              if (raw instanceof Date) return raw;
              const d = new Date(raw as string | number);
              return isNaN(d.getTime()) ? null : d;
            }
          : undefined,
        renderCell: (params) => {
          const row = params.row as GridRow;
          const resolver = (valueResolvers as Record<string, ValueResolver | undefined>)[col];
          const value = resolver ? resolver(row) : (row as Record<string, unknown>)[col];

          const fieldInfo = getFieldInfo(col);
          if (fieldInfo.isStateMachine) {
            const internationalizedValue = renderStateMachineValue(value, entityTypeName);
            return <span>{internationalizedValue}</span>;
          }

          const key1 = `${entityTypeName}.${col}`;
          const key2 = col;
          const key3 = entityTypeName;
          const renderer = resolveColumnRenderer(key1) || resolveColumnRenderer(key2) || resolveColumnRenderer(key3);
          if (renderer) {
            return <>{renderer({ entity: entityTypeName, field: col, row, value, gridParams: params })}</>;
          }
          return <span>{String(value ?? "")}</span>;
        },
      };
      return def;
    });

    return [actionColumn, ...dataColumns];
  }, [resolvedColumns, resolveLabel, entityTypeName, valueResolvers, fieldTypeByColumn, listField, getFieldInfo, renderStateMachineValue, locale, client]);

  const gridRows: GridRow[] = React.useMemo(() => {
    return (rows ?? []).map((row, idx) => ({ __rid: String((row as Record<string, unknown>)["id"] ?? `${listField}-${page}-${idx}`), ...row }));
  }, [rows, listField, page]);

  const PaginationComponent = React.useMemo(
    () => () => (
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage={resolveLabel(['grid.pagination.rowsPerPage'], { entity: listField }, 'Rows per page:')}
        labelDisplayedRows={({ from, to, count }: { from: number; to: number; count: number }) => {
          const template = resolveLabel(['grid.pagination.displayedRows'], { entity: listField }, '{from}–{to} de {count}');
          return template.replace('{from}', from.toString()).replace('{to}', to.toString()).replace('{count}', (count !== -1 ? count : `more than ${to}`).toString());
        }}
      />
    ),
    [locale, totalCount, page, rowsPerPage, resolveLabel, listField]
  );

  const localeText = React.useMemo(() => {
    const t = (k: string, d: string) => resolveLabel([`grid.${k}`], { entity: listField }, d);
    return {
      filterPanelColumns: t('filter.columns', 'Columns'),
      filterPanelOperator: t('filter.operator', 'Operator'),
      filterPanelValue: t('filter.value', 'Value'),
      filterOperatorContains: t('filter.contains', 'contains'),
      filterOperatorEquals: t('filter.equals', 'equals'),
      filterOperatorStartsWith: t('filter.startsWith', 'starts with'),
      filterOperatorEndsWith: t('filter.endsWith', 'ends with'),
      filterOperatorIs: t('filter.is', 'is'),
      filterOperatorNot: t('filter.not', 'not'),
      filterOperatorIsAnyOf: t('filter.isAnyOf', 'is any of'),
      filterOperatorGreaterThan: t('filter.greaterThan', 'greater than'),
      filterOperatorGreaterThanOrEqual: t('filter.greaterThanOrEqual', 'greater than or equal to'),
      filterOperatorLessThan: t('filter.lessThan', 'less than'),
      filterOperatorLessThanOrEqual: t('filter.lessThanOrEqual', 'less than or equal to'),
      columnMenuSortAsc: t('columnMenu.sortAsc', 'Sort by ASC'),
      columnMenuSortDesc: t('columnMenu.sortDesc', 'Sort by DESC'),
      columnMenuFilter: t('columnMenu.filter', 'Filter'),
      columnMenuHideColumn: t('columnMenu.hideColumn', 'Hide column'),
      columnMenuManageColumns: t('columnMenu.manageColumns', 'Manage columns'),
      columnMenuShowColumns: t('columnMenu.showColumns', 'Show columns'),
      columnMenuUnsort: t('columnMenu.unsort', 'Unsort'),
      filterPanelInputLabel: t('filterPanel.inputLabel', 'Value'),
      footerRowSelected: (count: number) =>
        count !== 1
          ? t('footer.rowsSelected', `${count.toLocaleString()} rows selected`)
          : t('footer.rowSelected', `${count.toLocaleString()} row selected`),
    };
  }, [resolveLabel, listField, locale]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{tableTitle}</Typography>
        <Tooltip title={`${resolveLabel(["button.create"], { entity: listField }, "Create")} ${resolveLabel([getEntityName(listField, 'plural')], { entity: listField }, listField)}`}>
          <IconButton color="primary" size="large" onClick={() => navigate(`/entities/${listField}/create`)}>
            <AddCircleIcon fontSize="large" />
          </IconButton>
        </Tooltip>
      </Stack>
      {loadingData && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading data…</Typography>
        </Box>
      )}
      {errorData && (
        <Typography color="error" variant="body2">Failed to load data: {errorData}</Typography>
      )}
      {!loadingData && !errorData && (
        <Paper sx={{ width: "100%", p: 0, minWidth: 0 }}>
          <DataGrid
            key={`datagrid-${locale}`}
            rows={gridRows}
            getRowId={(row: { __rid: string }) => row.__rid}
            columns={gridColumns}
            localeText={localeText}
            loading={loadingData}
            rowCount={totalCount ?? gridRows.length}
            pagination
            paginationMode="server"
            paginationModel={{ page, pageSize: rowsPerPage } as GridPaginationModel}
            onPaginationModelChange={(model) => {
              if (model.pageSize !== rowsPerPage) { setRowsPerPage(model.pageSize); setPage(0); }
              else if (model.page !== page) { setPage(model.page); }
            }}
            sortingMode="server"
            sortModel={sortModel}
            onSortModelChange={(model) => {
              const norm = (Array.isArray(model) ? model : [])
                .filter((m) => m.field && m.sort)
                .map((m) => ({ field: String(m.field), sort: m.sort as 'asc' | 'desc' }));
              setSortModel(norm);
            }}
            filterMode="server"
            filterModel={pendingFilterModel}
            onFilterModelChange={(model) => setPendingFilterModel(model)}
            pageSizeOptions={[5, 10, 25, 50]}
            slots={{
              toolbar: () => (
                <ServerToolbar
                  filterModel={pendingFilterModel}
                  onFilterModelChange={setPendingFilterModel}
                  onApply={() => setFilterModel(pendingFilterModel)}
                  onClear={() => { setPendingFilterModel({ items: [] }); setFilterModel({ items: [] }); updateURL({ filter: null }); }}
                  onOpenFilter={() => {
                    const root = document.querySelector('[data-mui-internal="GridRoot"]') || document.querySelector('[role="grid"]');
                    if (root) {
                      const toggleBtn = root.querySelector('[aria-label="Filters"]') || root.querySelector('[aria-label="Show filters"]') || root.querySelector('[aria-label="Hide filters"]');
                      (toggleBtn as HTMLButtonElement | null)?.click();
                    }
                  }}
                />
              ),
              filterPanel: () => (
                <ServerFilterPanel
                  onApply={(model) => setFilterModel(model)}
                  onClear={() => { setPendingFilterModel({ items: [] }); setFilterModel({ items: [] }); updateURL({ filter: null }); }}
                />
              ),
              pagination: PaginationComponent,
            }}
            disableRowSelectionOnClick
            sx={{ border: 0 }}
          />
        </Paper>
      )}
    </Box>
  );
}

export default EntityTable;
