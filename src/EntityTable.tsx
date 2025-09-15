import * as React from "react";
import { gql, useApolloClient, useQuery } from "@apollo/client";
import { Box, CircularProgress, Paper, Typography, Button, Stack, IconButton, Tooltip } from "@mui/material";
import { DataGrid, type GridColDef, type GridPaginationModel, type GridFilterModel, type GridFilterOperator, getGridNumericOperators, getGridBooleanOperators, GridFilterInputValue } from "@mui/x-data-grid";
import ServerToolbar from "./ServerToolbar";
import ServerFilterPanel from "./ServerFilterPanel";
import { TagsFilterInput, BetweenFilterInput, DateFilterInput, StateMachineFilterInput } from "./FilterInputs";
import { INTROSPECTION_QUERY, SchemaData, getElementTypeNameOfListField, buildSelectionSetForObjectType, ValueResolver, isNumericScalarName, isBooleanScalarName, isDateTimeScalarName, getTypeByName, unwrapNamedType } from "./lib/introspection";
import { resolveColumnRenderer } from "./lib/columnRenderers";
import { useI18n } from "./lib/i18n";
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';

type EntityTableProps = {
  listField: string; // e.g., "series"
};

function buildPaginatedListQuery(listField: string, selection: string, sortBlock: string | null, filterBlock: string | null) {
  const sortArg = sortBlock ? `, ${sortBlock}` : "";
  const filterArgs = filterBlock ? `, ${filterBlock}` : "";
  return gql`
    query DynamicList($page: Int!, $size: Int!, $count: Boolean!) {
      ${listField}(pagination: { page: $page, size: $size, count: $count }${sortArg}${filterArgs}) {
        ${selection}
      }
    }
  `;
}

type Row = Record<string, unknown>;

export default function EntityTable({ listField }: EntityTableProps) {
  const client = useApolloClient();
  const { data: schemaData } = useQuery(INTROSPECTION_QUERY);
  const { resolveLabel } = useI18n();
  // URL parameters will be handled by the parent application
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  // Navigation will be handled by the parent application
  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

    // Helper function to get entity name from i18n
  const getEntityName = (pluralName: string, form: 'single' | 'plural'): string => {
    if (!schemaData) return `entity.${pluralName}.${form}`;
    
    // Get the proper entity type name from schema
    const entityTypeName = getElementTypeNameOfListField(schemaData as SchemaData, pluralName);
    if (!entityTypeName) return `entity.${pluralName}.${form}`;
    
    // Convert to lowercase for i18n key
    const baseName = entityTypeName.toLowerCase();
    
    return `entity.${baseName}.${form}`;
  };

  const { selection, columns, valueResolvers, entityTypeName, sortFieldByColumn, fieldTypeByColumn } = React.useMemo(() => {
    const schema = schemaData as SchemaData | undefined;
    if (!schema)
      return {
        selection: "id",
        columns: ["id"],
        valueResolvers: { id: (r: Record<string, unknown>) => r["id"] } as Record<string, ValueResolver>,
        entityTypeName: listField,
         sortFieldByColumn: {},
         fieldTypeByColumn: {},
      } as const;
    const etn = getElementTypeNameOfListField(schema, listField);
    if (!etn)
      return {
        selection: "id",
        columns: ["id"],
        valueResolvers: { id: (r: Record<string, unknown>) => r["id"] } as Record<string, ValueResolver>,
        entityTypeName: listField,
         sortFieldByColumn: {},
         fieldTypeByColumn: {},
      } as const;
    return { ...buildSelectionSetForObjectType(schema, etn), entityTypeName: etn } as const;
  }, [schemaData, listField]);

  // Helper function to get field information including extensions
  const getFieldInfo = React.useCallback((fieldName: string) => {
    if (!schemaData || !entityTypeName) return null;
    
    const entityType = getTypeByName(schemaData as SchemaData, entityTypeName);
    if (!entityType?.fields) return null;
    
    const field = entityType.fields.find(f => f.name === fieldName);
    if (!field) return null;
    
    const fieldType = unwrapNamedType(field.type);
    const isStateMachine = field.extensions?.stateMachine === true;
    const isEnum = fieldType && schemaData.__schema.types.find((t: { name?: string; kind?: string }) => t.name === fieldType)?.kind === "ENUM";
    
    return {
      field,
      fieldType,
      isStateMachine,
      isEnum,
      enumValues: isEnum && fieldType ? 
        schemaData.__schema.types.find((t: { name?: string; enumValues?: Array<{ name: string }> }) => t.name === fieldType)?.enumValues?.map((ev: { name: string }) => ev.name) || [] 
        : []
    };
  }, [schemaData, entityTypeName]);

  // Helper function to render state machine field values
  const renderStateMachineValue = React.useCallback((value: unknown, entityTypeName: string) => {
    if (value == null) return "";
    
    const stateKey = `stateMachine.${entityTypeName.toLowerCase()}.state.${value}`;
    return resolveLabel([stateKey], { entity: entityTypeName }, String(value));
  }, [resolveLabel]);

  const [page, setPage] = React.useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = React.useState<number>(10);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [totalCount, setTotalCount] = React.useState<number | null>(null);
  const [loadingData, setLoadingData] = React.useState<boolean>(false);
  const [errorData, setErrorData] = React.useState<string | null>(null);
  const [sortModel, setSortModel] = React.useState<{ field: string; sort: 'asc' | 'desc' }[]>([]);
  const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });
  const [pendingFilterModel, setPendingFilterModel] = React.useState<GridFilterModel>({ items: [] });

  const filterBlock: string | null = React.useMemo(() => {
    if (!filterModel?.items?.length) return null;
    const byField = new Map<string, { operator: string; value: unknown }[]>();
    for (const item of filterModel.items) {
      if (!item.field || item.value == null || item.value === '') continue;
      const field = String(item.field);
      const opMap: Record<string, string> = {
        contains: 'LIKE', startsWith: 'LIKE', endsWith: 'LIKE', equals: 'EQ', '=': 'EQ', is: 'EQ', '!=': 'NE', not: 'NE',
        greaterThan: 'GT', '>': 'GT', greaterThanOrEqual: 'GTE', '>=': 'GTE', lessThan: 'LT', '<': 'LT', lessThanOrEqual: 'LTE', '<=': 'LTE',
        isAnyOf: 'IN', in: 'IN', nin: 'NIN', btw: 'BTW'
      };
      const operator = opMap[item.operator ?? 'equals'] ?? 'EQ';
      const value = item.value as unknown;
      const arr = byField.get(field) ?? [];
      arr.push({ operator, value });
      byField.set(field, arr);
    }
    if (byField.size === 0) return null;

    const parts: string[] = [];
    byField.forEach((conds, col) => {
      const sortField = (sortFieldByColumn as Record<string, string | undefined>)[col];
      const isObjectColumn = sortField ? sortField.includes('.') : false;
      const typeName = (fieldTypeByColumn as Record<string, string | undefined>)[col];
      const isNumeric = isNumericScalarName(typeName);
      const isBoolean = isBooleanScalarName(typeName);
      const allowedOpsScalar = isNumeric ? new Set(["EQ","NE","GT","GTE","LT","LTE","IN","NIN","BTW"]) : isBoolean ? new Set(["EQ","NE"]) : new Set(["EQ","NE","LIKE","IN","NIN"]);
      if (!isObjectColumn) {
        const { operator, value } = conds[0];
        if (!allowedOpsScalar.has(operator)) return;
        const toLiteral = (v: unknown) => isNumeric ? String(Number(v)) : isBoolean ? String(Boolean(v)) : JSON.stringify(String(v));
        if (operator === 'IN' || operator === 'NIN') {
          const values = Array.isArray(value) ? value : [value];
          const arrLit = `[${values.map(toLiteral).join(', ')}]`;
          parts.push(`${col}: { operator: ${operator}, value: ${arrLit} }`);
        } else if (operator === 'BTW') {
          const values = Array.isArray(value) ? value : [value, value];
          const arrLit = `[${values.slice(0,2).map(toLiteral).join(', ')}]`;
          parts.push(`${col}: { operator: ${operator}, value: ${arrLit} }`);
        } else {
          const valueLiteral = toLiteral(value);
          parts.push(`${col}: { operator: ${operator}, value: ${valueLiteral} }`);
        }
      } else {
        const pathWithin = sortField!.split('.').slice(1).join('.');
        const terms = conds.map(({ operator, value }) => {
          const toLiteral = (v: unknown) => isNumeric ? String(Number(v)) : isBoolean ? String(Boolean(v)) : JSON.stringify(String(v));
          if (operator === 'IN' || operator === 'NIN' || operator === 'BTW') {
            const values = Array.isArray(value) ? value : [value];
            const arrLit = operator === 'BTW' ? `[${values.slice(0,2).map(toLiteral).join(', ')}]` : `[${values.map(toLiteral).join(', ')}]`;
            return `{ path: ${JSON.stringify(pathWithin)}, operator: ${operator}, value: ${arrLit} }`;
          }
          const valueLiteral = toLiteral(value);
          return `{ path: ${JSON.stringify(pathWithin)}, operator: ${operator}, value: ${valueLiteral} }`;
        }).join(', ');
        parts.push(`${col}: { terms: [ ${terms} ] }`);
      }
    });
    return parts.length ? parts.join(', ') : null;
  }, [filterModel, sortFieldByColumn, fieldTypeByColumn]);

  // URL state management
  const updateURL = React.useCallback((updates: {
    page?: number | null;
    size?: number | null;
    sort?: { field: string; sort: 'asc' | 'desc' }[] | null;
    filter?: GridFilterModel | null;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (updates.page !== undefined) {
      if (updates.page === null || updates.page === 0) {
        params.delete('page');
      } else {
        params.set('page', String(updates.page + 1)); // Convert to 1-based for URL
      }
    }
    
    if (updates.size !== undefined) {
      if (updates.size === null || updates.size === 10) {
        params.delete('size');
      } else {
        params.set('size', String(updates.size));
      }
    }
    
    if (updates.sort !== undefined) {
      if (updates.sort === null || updates.sort.length === 0) {
        params.delete('sort');
      } else {
        const sortStr = updates.sort.map(s => `${s.field}:${s.sort}`).join(',');
        params.set('sort', sortStr);
      }
    }
    
    if (updates.filter !== undefined) {
      if (updates.filter === null || updates.filter.items.length === 0) {
        params.delete('filter');
      } else {
        const filterStr = JSON.stringify(updates.filter);
        params.set('filter', filterStr);
      }
    }
    
    const newURL = `${window.location.pathname}?${params.toString()}`;
    // URL update will be handled by the parent application
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', newURL);
    }
  }, [searchParams]);

  // Initialize state from URL
  React.useEffect(() => {
    const pageParam = searchParams.get('page');
    const sizeParam = searchParams.get('size');
    const sortParam = searchParams.get('sort');
    const filterParam = searchParams.get('filter');
    
    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        setPage(pageNum - 1); // Convert from 1-based to 0-based
      }
    }
    
    if (sizeParam) {
      const sizeNum = parseInt(sizeParam, 10);
      if (!isNaN(sizeNum) && [5, 10, 25, 50].includes(sizeNum)) {
        setRowsPerPage(sizeNum);
      }
    }
    
    if (sortParam) {
      try {
        const sortItems = sortParam.split(',').map(item => {
          const [field, sort] = item.split(':');
          return { field, sort: sort as 'asc' | 'desc' };
        });
        setSortModel(sortItems);
      } catch {
        console.warn('Invalid sort parameter:', sortParam);
      }
    }
    
    if (filterParam) {
      try {
        const filterModel = JSON.parse(filterParam);
        setFilterModel(filterModel);
        setPendingFilterModel(filterModel);
      } catch {
        console.warn('Invalid filter parameter:', filterParam);
      }
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (!selection) return;
    let cancelled = false;
    setLoadingData(true);
    setErrorData(null);
    const hasSort = sortModel.length > 0;
    const sortBlock = hasSort
      ? (() => {
          const terms = sortModel
            .map((s) => {
              const field = (sortFieldByColumn as Record<string, string | undefined>)[s.field] ?? s.field;
              const order = s.sort === 'asc' ? 'ASC' : 'DESC';
              return `{ field: "${field}", order: ${order} }`;
            })
            .join(', ');
          return `sort: { terms: [ ${terms} ] }`;
        })()
      : null;
    client
      .query({
        query: buildPaginatedListQuery(listField, selection, sortBlock, filterBlock),
        variables: {
          page: page + 1,
          size: rowsPerPage,
          count: true,
        },
        fetchPolicy: "network-only",
      })
      .then((result) => {
        if (cancelled) return;
        const raw = (result.data?.[listField] as unknown) as Row[] | undefined;
        setRows(Array.isArray(raw) ? raw : []);
        // Apollo doesn't expose extensions directly on result, but on the response context.
        // However, simfinity returns count in the top-level extensions of the HTTP response.
        // We can read it via the legacy __response field if present, otherwise default to null.
        const anyResult = result as unknown as { extensions?: Record<string, unknown> };
        const ext = anyResult.extensions;
        const c = typeof ext?.count === "number" ? (ext.count as number) : null;
        setTotalCount(c);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorData(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, listField, selection, page, rowsPerPage, sortModel, sortFieldByColumn, filterBlock]);

  // Update URL when state changes
  React.useEffect(() => {
    updateURL({ page, size: rowsPerPage });
  }, [page, rowsPerPage, updateURL]);

  React.useEffect(() => {
    updateURL({ sort: sortModel });
  }, [sortModel, updateURL]);

  React.useEffect(() => {
    updateURL({ filter: filterModel });
  }, [filterModel, updateURL]);

  const resolvedColumns = columns;
  const entityNameForLabels = entityTypeName;
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
              <IconButton
                size="small"
                onClick={() => navigate(`/entities/${listField}/${entityId}/view`)}
                color="primary"
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={resolveLabel(["actions.edit"], { entity: listField }, "Edit")}>
              <IconButton
                size="small"
                onClick={() => navigate(`/entities/${listField}/${entityId}/edit`)}
                color="primary"
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    };

    const dataColumns = resolvedColumns.map((col) => {
      const header = resolveLabel([`${entityNameForLabels}.${col}`], { entity: entityNameForLabels, field: col }, col);
      const typeName = (fieldTypeByColumn as Record<string, string | undefined>)[col];
      const isNumeric = isNumericScalarName(typeName);
      const isBoolean = isBooleanScalarName(typeName);
      const isDate = isDateTimeScalarName(typeName);
      const def: GridColDef<GridRow> = {
        field: col,
        headerName: header,
        flex: 1,
        minWidth: 140,
        type: isNumeric ? 'number' : isBoolean ? 'boolean' : isDate ? 'dateTime' : 'string',
        headerAlign: 'left',
        align: 'left',
        filterOperators: (() => {
          // Check if this is a state machine field
          const fieldInfo = getFieldInfo(col);
          if (fieldInfo?.isStateMachine && fieldInfo.isEnum) {
            // State machine fields: only equals operator with select dropdown
            return [
              { 
                label: '=', 
                value: 'equals', 
                getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], 
                InputComponent: StateMachineFilterInput,
                InputComponentProps: { 
                  entityTypeName: entityNameForLabels,
                  fieldName: col,
                  enumValues: fieldInfo.enumValues,
                  resolveLabel
                } 
              } as unknown as GridFilterOperator,
            ];
          }
          
          if (isNumeric) {
            const base = getGridNumericOperators();
            const keep = new Set(['=', '!=', '>', '>=', '<', '<=', 'equals']);
            return [
              ...base.filter((o) => (o.value ? keep.has(o.value) : false)),
              { label: 'between', value: 'btw', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: BetweenFilterInput, InputComponentProps: { inputType: 'number' } } as unknown as GridFilterOperator,
              { label: 'in', value: 'in', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: TagsFilterInput } as unknown as GridFilterOperator,
              { label: 'not in', value: 'nin', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: TagsFilterInput } as unknown as GridFilterOperator,
            ];
          }
          if (isBoolean) {
            return getGridBooleanOperators();
          }
          if (isDate) {
            // Symbols for labels, same set as numbers, plus between; no IN/NIN
            return [
              { label: '=', value: 'equals', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: '!=', value: '!=', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: '>', value: '>', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: '>=', value: '>=', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: '<', value: '<', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: '<=', value: '<=', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: DateFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
              { label: 'between', value: 'btw', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: BetweenFilterInput, InputComponentProps: { inputType: 'datetime-local' } } as unknown as GridFilterOperator,
            ];
          }
          // Strings: only contains, equals, not equal ("!="), in, nin; symbols for equals/!=
          return [
            { label: 'contains', value: 'contains', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: GridFilterInputValue } as unknown as GridFilterOperator,
            { label: '=', value: 'equals', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: GridFilterInputValue } as unknown as GridFilterOperator,
            { label: '!=', value: '!=', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: GridFilterInputValue } as unknown as GridFilterOperator,
            { label: 'in', value: 'in', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: TagsFilterInput } as unknown as GridFilterOperator,
            { label: 'not in', value: 'nin', getApplyFilterFn: undefined as unknown as GridFilterOperator['getApplyFilterFn'], InputComponent: TagsFilterInput } as unknown as GridFilterOperator,
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

          // Check if this is a state machine field
          const fieldInfo = getFieldInfo(col);
          if (fieldInfo?.isStateMachine) {
            const internationalizedValue = renderStateMachineValue(value, entityNameForLabels);
            return <span>{internationalizedValue}</span>;
          }

          // Custom renderer resolution by ordered keys:
          // 1) entity.field  2) field  3) entity
          const key1 = `${entityNameForLabels}.${col}`;
          const key2 = col;
          const key3 = entityNameForLabels;
          const renderer =
            resolveColumnRenderer(key1) ||
            resolveColumnRenderer(key2) ||
            resolveColumnRenderer(key3);
          if (renderer) {
            return (
              <>{renderer({ entity: entityNameForLabels, field: col, row, value, gridParams: params })}</>
            );
          }
          return <span>{String(value ?? "")}</span>;
        },
      };
      return def;
    });

    return [actionColumn, ...dataColumns];
  }, [resolvedColumns, resolveLabel, entityNameForLabels, valueResolvers, fieldTypeByColumn, listField, getFieldInfo, renderStateMachineValue]);

  const gridRows: GridRow[] = React.useMemo(() => {
    return rows.map((row, idx) => ({ __rid: String((row as Record<string, unknown>)["id"] ?? `${listField}-${page}-${idx}`), ...row }));
  }, [rows, listField, page]);

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
    } as const;
  }, [resolveLabel, listField]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">
          {tableTitle}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate(`/entities/${listField}/create`)}
        >
          {resolveLabel(["button.create"], { entity: listField }, "Create")} {resolveLabel([getEntityName(listField, 'plural')], { entity: listField }, listField)}
        </Button>
      </Stack>
      {loadingData && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading data…</Typography>
        </Box>
      )}
      {errorData && (
        <Typography color="error" variant="body2">
          Failed to load data: {errorData}
        </Typography>
      )}
      {!loadingData && !errorData && (
        <Paper sx={{ width: "100%", p: 0, minWidth: 0 }}>
          <DataGrid
            rows={gridRows}
            getRowId={(row: { __rid: string }) => row.__rid}
            columns={gridColumns}
            localeText={localeText}
            loading={loadingData}
            rowCount={totalCount ?? gridRows.length}
            paginationMode="server"
            paginationModel={{ page, pageSize: rowsPerPage } as GridPaginationModel}
            onPaginationModelChange={(model) => {
              if (model.pageSize !== rowsPerPage) {
                setRowsPerPage(model.pageSize);
                setPage(0);
              } else if (model.page !== page) {
                setPage(model.page);
              }
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
                  onClear={() => { 
                    setPendingFilterModel({ items: [] }); 
                    setFilterModel({ items: [] }); 
                    updateURL({ filter: null });
                  }}
                  onOpenFilter={() => {
                    // Directly call the grid API when possible
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
                  onClear={() => { 
                    setPendingFilterModel({ items: [] }); 
                    setFilterModel({ items: [] }); 
                    updateURL({ filter: null });
                  }}
                />
              ),
            }}
            disableRowSelectionOnClick
            sx={{ border: 0 }}
          />
        </Paper>
      )}
    </Box>
  );
}


