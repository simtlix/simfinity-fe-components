import * as React from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TablePagination,
  Tooltip,
  Typography,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import FilterListIcon from "@mui/icons-material/FilterList";
import { useI18n } from "./lib/i18n";
import { useSimfinityClient, useFind, buildValueResolvers } from "./lib/simfinityClient";
import { useEntityListState } from "./hooks/useEntityListState";
import StandaloneFilterPanel from "./StandaloneFilterPanel";

type EntityCardListProps<T = Record<string, unknown>> = {
  listField: string;
  renderCard: (item: T, reload: () => void, onNavigate?: (path: string) => void) => React.ReactNode;
  getSearchParams?: () => URLSearchParams;
  onSearchParamsChange?: (params: URLSearchParams) => void;
  onNavigate?: (path: string) => void;
  showFilterPanel?: boolean;
};

function EntityCardList<T extends Record<string, unknown>>({
  listField,
  renderCard,
  getSearchParams,
  onSearchParamsChange,
  onNavigate,
  showFilterPanel = true,
}: EntityCardListProps<T>) {
  const client = useSimfinityClient();
  const { resolveLabel } = useI18n();

  const entityTypeName = React.useMemo(
    () => client.getTypeNameForQuery(listField) ?? listField,
    [client, listField]
  );

  const { selectionMeta } = React.useMemo(
    () => buildValueResolvers(client, entityTypeName),
    [client, entityTypeName]
  );

  const { selection, columns: resolvedColumns, sortFieldByColumn, fieldTypeByColumn } = selectionMeta;

  const getFieldInfo = React.useCallback(
    (fieldName: string) => {
      const isStateMachine = client.isStateMachineField(entityTypeName, fieldName);
      const fType = fieldTypeByColumn[fieldName];
      const enumValues = fType ? client.getEnumValues(fType) : [];
      const isEnum = enumValues.length > 0;
      return { isStateMachine, isEnum, enumValues, fieldType: fType };
    },
    [client, entityTypeName, fieldTypeByColumn]
  );

  const navigate = React.useCallback(
    (path: string) => {
      if (onNavigate) onNavigate(path);
      else if (typeof window !== "undefined") window.location.href = path;
    },
    [onNavigate]
  );

  const getEntityName = (form: "single" | "plural"): string => {
    const baseName = entityTypeName.toLowerCase();
    return `entity.${baseName}.${form}`;
  };

  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false);

  const {
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    sortModel,
    setSortModel,
    filterModel,
    setFilterModel,
    pendingFilterModel,
    setPendingFilterModel,
    filterItems,
    sortTerms,
    updateURL,
  } = useEntityListState({ getSearchParams, onSearchParamsChange });

  const buildReturnTo = React.useCallback(() => {
    const params = new URLSearchParams();
    if (page > 0) params.set("page", String(page + 1));
    if (rowsPerPage !== 10) params.set("size", String(rowsPerPage));
    if (sortModel.length > 0) params.set("sort", sortModel.map((s) => `${s.field}:${s.sort}`).join(","));
    if (filterModel.items.length > 0) params.set("filter", JSON.stringify(filterModel));
    const qs = params.toString();
    return `/entities/${listField}/cards${qs ? `?${qs}` : ""}`;
  }, [listField, page, rowsPerPage, sortModel, filterModel]);

  const navigateWithReturn = React.useCallback(
    (path: string) => {
      const returnTo = buildReturnTo();
      const sep = path.includes("?") ? "&" : "?";
      navigate(`${path}${sep}returnTo=${encodeURIComponent(returnTo)}`);
    },
    [buildReturnTo, navigate]
  );

  const { data: rows, loading: loadingData, error: errorObj, totalCount, refetch } = useFind<T>(
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

  const tableTitle = resolveLabel([getEntityName("plural")], { entity: listField }, listField);

  const handleApplyFilter = React.useCallback(() => {
    setFilterModel(pendingFilterModel);
    setFilterPanelOpen(false);
  }, [pendingFilterModel, setFilterModel]);

  const handleClearFilter = React.useCallback(() => {
    setPendingFilterModel({ items: [] });
    setFilterModel({ items: [] });
    updateURL({ filter: null });
  }, [setPendingFilterModel, setFilterModel, updateURL]);

  const handleOpenFilter = React.useCallback(() => {
    setFilterPanelOpen((prev) => !prev);
  }, []);

  const sortFieldOptions = resolvedColumns.map((col) => ({
    value: col,
    label: resolveLabel([`${entityTypeName.toLowerCase()}.${col}`], { entity: entityTypeName, field: col }, col),
  }));

  const currentSortField = sortModel[0]?.field ?? (resolvedColumns[0] ?? "");
  const currentSortDir = sortModel[0]?.sort ?? "asc";

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{tableTitle}</Typography>
        <Tooltip
          title={`${resolveLabel(["button.create"], { entity: listField }, "Create")} ${resolveLabel(
            [getEntityName("plural")],
            { entity: listField },
            listField
          )}`}
        >
          <IconButton color="primary" size="large" onClick={() => navigateWithReturn(`/entities/${listField}/create`)}>
            <AddCircleIcon fontSize="large" />
          </IconButton>
        </Tooltip>
      </Stack>

      {showFilterPanel && (
        <StandaloneFilterPanel
            filterModel={pendingFilterModel}
            onFilterModelChange={setPendingFilterModel}
            entityTypeName={entityTypeName}
            resolvedColumns={resolvedColumns}
            fieldTypeByColumn={fieldTypeByColumn}
            getFieldInfo={getFieldInfo}
            listField={listField}
            client={client}
            onApply={handleApplyFilter}
            onClear={handleClearFilter}
            open={filterPanelOpen}
            onOpenChange={setFilterPanelOpen}
          />
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>{resolveLabel(["grid.sort.sortBy"], { entity: listField }, "Sort by")}</InputLabel>
          <Select
            value={currentSortField}
            label={resolveLabel(["grid.sort.sortBy"], { entity: listField }, "Sort by")}
            onChange={(e) => {
              const field = e.target.value;
              setSortModel([{ field, sort: currentSortDir }]);
            }}
          >
            {sortFieldOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip
          title={
            currentSortDir === "asc"
              ? resolveLabel(["grid.sort.asc"], { entity: listField }, "Ascending")
              : resolveLabel(["grid.sort.desc"], { entity: listField }, "Descending")
          }
        >
          <IconButton
            size="small"
            onClick={() => {
              const nextSort = currentSortDir === "asc" ? "desc" : "asc";
              setSortModel([{ field: currentSortField, sort: nextSort }]);
            }}
            aria-label={
              currentSortDir === "asc"
                ? resolveLabel(["grid.sort.asc"], { entity: listField }, "Ascending")
                : resolveLabel(["grid.sort.desc"], { entity: listField }, "Descending")
            }
          >
            {currentSortDir === "asc" ? (
              <ArrowUpwardIcon fontSize="small" />
            ) : (
              <ArrowDownwardIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        </Stack>
        {showFilterPanel && (
          <Tooltip title={resolveLabel(["grid.filter.filter"], { entity: listField }, "Filter")}>
            <IconButton
              color={filterModel.items.length > 0 ? "primary" : "default"}
              onClick={handleOpenFilter}
              aria-label={resolveLabel(["grid.filter.filter"], { entity: listField }, "Filter")}
            >
              <FilterListIcon />
            </IconButton>
          </Tooltip>
        )}
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
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
{(rows ?? []).map((item, idx) => (
            <Grid key={String((item as Record<string, unknown>).id ?? `${listField}-${page}-${idx}`)} size={{ xs: 12, sm: 6, md: 4 }}>
                {renderCard(item, refetch, navigateWithReturn)}
              </Grid>
            ))}
          </Grid>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage={resolveLabel(["grid.pagination.cardsPerPage"], { entity: listField }, "Cards per page:")}
            labelDisplayedRows={({ from, to, count }: { from: number; to: number; count: number }) => {
              const template = resolveLabel(
                ["grid.pagination.displayedRows"],
                { entity: listField },
                "{from}–{to} de {count}"
              );
              return template
                .replace("{from}", from.toString())
                .replace("{to}", to.toString())
                .replace("{count}", (count !== -1 ? count : `more than ${to}`).toString());
            }}
          />
        </>
      )}
    </Box>
  );
}

export default EntityCardList;
