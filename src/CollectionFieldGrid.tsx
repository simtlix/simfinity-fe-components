import * as React from "react";
import { 
  Box, 
  CircularProgress, 
  Typography, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  TablePagination
} from "@mui/material";
import { DataGrid, type GridColDef, type GridPaginationModel } from "@mui/x-data-grid";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RestoreIcon from "@mui/icons-material/Restore";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import { resolveColumnRenderer } from "./lib/columnRenderers";
import { useI18n } from "./lib/i18n";
import CollectionItemEditForm from "./CollectionItemEditForm";
import { getFormCustomization, getCollectionOnDelete, getCollectionOnRestore, getCollectionOnBeforeEdit, getCollectionOnBeforeCreate, FormMessage, ParentFormAccess } from "./lib/formCustomization";
import { useSimfinityClient, useFindByParent, buildValueResolvers } from "./lib/simfinityClient";

export type CollectionItemStatus = 'original' | 'added' | 'modified' | 'deleted';

export interface CollectionItem {
  id: string;
  [key: string]: unknown;
  __status?: CollectionItemStatus;
  __originalData?: Record<string, unknown>;
}

export interface CollectionFieldState {
  added: CollectionItem[];
  modified: CollectionItem[];
  deleted: CollectionItem[];
}

type CollectionFieldGridProps = {
  collectionField: {
    name: string;
    objectTypeName: string;
    connectionField: string;
  };
  parentEntityId: string;
  parentEntityType: string;
  isEditMode?: boolean;
  collectionState?: CollectionFieldState;
  onCollectionStateChange?: (fieldName: string, newState: CollectionFieldState) => void;
  parentFormAccess?: ParentFormAccess;
};

export default function CollectionFieldGrid({
  parentEntityType, 
  collectionField, 
  parentEntityId,
  isEditMode = false,
  collectionState,
  onCollectionStateChange,
  parentFormAccess
}: CollectionFieldGridProps) {
  const client = useSimfinityClient();
  const { resolveLabel, locale } = useI18n();

  const { valueResolvers, selectionMeta } = React.useMemo(
    () => buildValueResolvers(client, collectionField.objectTypeName),
    [client, collectionField.objectTypeName]
  );

  const { selection, columns, sortFieldByColumn } = selectionMeta;

  const getFieldInfo = React.useCallback((fieldName: string) => {
    const isStateMachine = client.isStateMachineField(collectionField.objectTypeName, fieldName);
    const fType = selectionMeta.fieldTypeByColumn[fieldName];
    const enumValues = fType ? client.getEnumValues(fType) : [];
    const isEnum = enumValues.length > 0;
    return { isStateMachine, isEnum, enumValues, fieldType: fType };
  }, [client, collectionField.objectTypeName, selectionMeta.fieldTypeByColumn]);

  const renderStateMachineValue = React.useCallback((value: unknown, entityTypeName: string) => {
    if (value == null) return "";
    const stateKey = `stateMachine.${entityTypeName.toLowerCase()}.state.${value}`;
    return resolveLabel([stateKey], { entity: entityTypeName }, String(value));
  }, [resolveLabel]);

  const getEntityName = (_pluralName: string, form: 'single' | 'plural'): string => {
    const baseName = collectionField.objectTypeName.toLowerCase();
    return `entity.${baseName}.${form}`;
  };

  const [localCollectionState, setLocalCollectionState] = React.useState<CollectionFieldState>({
    added: [], modified: [], deleted: []
  });

  const [editFormOpen, setEditFormOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<CollectionItem | null>(null);
  const [isAddingNew, setIsAddingNew] = React.useState(false);
  const [message, setMessage] = React.useState<FormMessage | null>(null);

  const currentState = collectionState || localCollectionState;
  const setCurrentState = React.useMemo(() => 
    onCollectionStateChange 
      ? (newState: CollectionFieldState | ((prev: CollectionFieldState) => CollectionFieldState)) => {
          if (typeof newState === 'function') {
            onCollectionStateChange(collectionField.name, newState(currentState));
          } else {
            onCollectionStateChange(collectionField.name, newState);
          }
        }
      : setLocalCollectionState,
    [onCollectionStateChange, collectionField.name, currentState]
  );

  const [page, setPage] = React.useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = React.useState<number>(5);
  const [sortModel, setSortModel] = React.useState<{ field: string; sort: 'asc' | 'desc' }[]>([]);

  const displayColumns = React.useMemo(() => {
    return columns.filter(column => column !== collectionField.connectionField);
  }, [columns, collectionField.connectionField]);

  const excludeIds = React.useMemo(() => {
    if (!isEditMode) return [];
    return [
      ...currentState.modified.map(item => item.id),
      ...currentState.deleted.map(item => item.id)
    ];
  }, [isEditMode, currentState.modified, currentState.deleted]);

  const sortTerms = React.useMemo(
    () => sortModel.map(s => ({
      field: (sortFieldByColumn as Record<string, string | undefined>)[s.field] ?? s.field,
      order: (s.sort === 'asc' ? 'ASC' : 'DESC') as 'ASC' | 'DESC'
    })),
    [sortModel, sortFieldByColumn]
  );

  const { data: collectionItems, loading: collectionLoading, error: collectionError, totalCount } = useFindByParent<Record<string, unknown>>(
    collectionField.objectTypeName,
    collectionField.connectionField,
    parentEntityId || null,
    {
      page,
      size: rowsPerPage,
      sort: sortTerms,
      excludeIds,
      fields: selection,
      sortFieldByColumn,
    }
  );

  const rows = React.useMemo(() => {
    if (!collectionItems) return [];
    return collectionItems.map((item) => {
      const processedRow: Record<string, unknown> = { id: item.id };
      columns.forEach(column => {
        if (column !== 'id' && valueResolvers[column]) {
          processedRow[column] = valueResolvers[column](item);
        } else if (column !== 'id') {
          processedRow[column] = item[column];
        }
      });
      processedRow.__originalData = item;
      return processedRow;
    });
  }, [collectionItems, columns, valueResolvers]);

  const handleEditItem = React.useCallback(async (item: Record<string, unknown>) => {
    const parentCustomization = getFormCustomization(parentEntityType, "edit");
    const onBeforeEditCallback = getCollectionOnBeforeEdit(parentCustomization || {}, collectionField.name);

    if (onBeforeEditCallback) {
      try {
        const shouldContinue = await onBeforeEditCallback(item, setMessage, parentFormAccess?.parentFormData || {});
        if (shouldContinue === false) return;
      } catch { return; }
    }

    const originalData = item.__originalData as Record<string, unknown>;
    setEditingItem((originalData || item) as CollectionItem);
    setIsAddingNew(false);
    setEditFormOpen(true);
  }, [parentEntityType, collectionField.name, parentFormAccess?.parentFormData]);

  const handleDeleteItem = React.useCallback(async (item: Record<string, unknown>) => {
    const parentCustomization = getFormCustomization(parentEntityType, "edit");
    const onDeleteCallback = getCollectionOnDelete(parentCustomization || {}, collectionField.name);

    if (onDeleteCallback) {
      try {
        const shouldContinue = await onDeleteCallback(item, setMessage);
        if (shouldContinue === false) return;
      } catch { return; }
    }

    if (currentState.added.some(i => i.id === item.id)) {
      const onRestoreCallback = getCollectionOnRestore(parentCustomization || {}, collectionField.name);
      if (onRestoreCallback) {
        try {
          const shouldContinue = await onRestoreCallback(item, 'added', setMessage);
          if (shouldContinue === false) return;
        } catch { return; }
      }
      setCurrentState(prev => ({ ...prev, added: prev.added.filter(i => i.id !== item.id) }));
      return;
    }
    if (currentState.modified.some(i => i.id === item.id)) {
      const modifiedItem = currentState.modified.find(i => i.id === item.id);
      if (modifiedItem) {
        setCurrentState(prev => ({
          ...prev,
          modified: prev.modified.filter(i => i.id !== item.id),
          deleted: [...prev.deleted, { ...modifiedItem, __status: 'deleted' as CollectionItemStatus }]
        }));
      }
      return;
    }
    setCurrentState(prev => ({
      ...prev,
      deleted: [...prev.deleted, { ...item, __status: 'deleted' as CollectionItemStatus } as CollectionItem]
    }));
  }, [currentState.added, currentState.modified, setCurrentState, parentEntityType, collectionField.name]);

  const handleRestoreItem = React.useCallback(async (item: CollectionItem) => {
    const status = item.__status as 'deleted' | 'modified';
    if (!status || (status !== 'deleted' && status !== 'modified')) return;

    const parentCustomization = getFormCustomization(parentEntityType, "edit");
    const onRestoreCallback = getCollectionOnRestore(parentCustomization || {}, collectionField.name);

    if (onRestoreCallback) {
      try {
        const shouldContinue = await onRestoreCallback(item, status, setMessage);
        if (shouldContinue === false) return;
      } catch { return; }
    }

    if (status === 'deleted') {
      setCurrentState(prev => ({ ...prev, deleted: prev.deleted.filter(i => i.id !== item.id) }));
    } else if (status === 'modified') {
      setCurrentState(prev => ({ ...prev, modified: prev.modified.filter(i => i.id !== item.id) }));
    }
  }, [setCurrentState, parentEntityType, collectionField.name]);

  const handleAddItem = React.useCallback(async () => {
    const parentCustomization = getFormCustomization(parentEntityType, "edit");
    const onBeforeCreateCallback = getCollectionOnBeforeCreate(parentCustomization || {}, collectionField.name);

    if (onBeforeCreateCallback) {
      try {
        const shouldContinue = await onBeforeCreateCallback(setMessage, parentFormAccess?.parentFormData || {});
        if (shouldContinue === false) return;
      } catch { return; }
    }

    const newItem: CollectionItem = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      __status: 'added',
      ...Object.fromEntries(displayColumns.map(col => [col, col === 'id' ? undefined : '']))
    };
    setEditingItem(newItem);
    setIsAddingNew(true);
    setEditFormOpen(true);
  }, [displayColumns, parentEntityType, collectionField.name, parentFormAccess?.parentFormData]);

  const handleSaveEditedItem = React.useCallback((updatedItem: CollectionItem) => {
    if (isAddingNew) {
      const savedItem = { ...updatedItem, __status: 'added' as const, __originalData: { ...updatedItem } };
      setCurrentState(prev => ({ ...prev, added: [...prev.added, savedItem] }));
    } else {
      const savedItem = { ...updatedItem, __originalData: updatedItem.__originalData || editingItem?.__originalData };
      const isEditingAddedItem = currentState.added.some(i => i.id === updatedItem.id);
      if (isEditingAddedItem) {
        setCurrentState(prev => ({ ...prev, added: prev.added.map(i => i.id === updatedItem.id ? savedItem : i) }));
      } else {
        setCurrentState(prev => ({ ...prev, modified: [...prev.modified.filter(i => i.id !== updatedItem.id), savedItem] }));
      }
    }
    setEditFormOpen(false);
    setEditingItem(null);
    setIsAddingNew(false);
  }, [setCurrentState, editingItem, isAddingNew, currentState.added]);

  const renderCellContent = React.useCallback((item: Record<string, unknown>, column: string): React.ReactNode => {
    if (column === 'id') return item[column]?.toString() || '';
    const value = valueResolvers[column] ? valueResolvers[column](item) : item[column];
    const fieldInfo = getFieldInfo(column);
    if (fieldInfo.isStateMachine) {
      return <span>{renderStateMachineValue(value, collectionField.objectTypeName)}</span>;
    }
    const renderer = resolveColumnRenderer(`${collectionField.objectTypeName}.${column}`);
    if (renderer) {
      return renderer({ entity: collectionField.objectTypeName, field: column, row: item, value, gridParams: { row: item, value, field: column, colDef: { field: column } } as { row: Record<string, unknown>; value: unknown; field: string; colDef: { field: string } } });
    }
    return value?.toString() || '';
  }, [valueResolvers, collectionField.objectTypeName, getFieldInfo, renderStateMachineValue]);

  const gridColumns: GridColDef[] = React.useMemo(() => {
    const baseColumns = displayColumns.map(column => {
      const columnDef: GridColDef = {
        field: column,
        headerName: resolveLabel([`${collectionField.objectTypeName.toLowerCase()}.${column}`], { entity: collectionField.name, field: column }, column),
        flex: 1, minWidth: 150, sortable: true, filterable: false,
      };
      const fieldInfo = getFieldInfo(column);
      if (fieldInfo.isStateMachine) {
        columnDef.renderCell = (params) => {
          const value = valueResolvers[column] ? valueResolvers[column](params.row) : params.row[column];
          return <span>{renderStateMachineValue(value, collectionField.objectTypeName)}</span>;
        };
      } else {
        const renderer = resolveColumnRenderer(`${collectionField.objectTypeName}.${column}`);
        if (renderer) {
          columnDef.renderCell = (params) => {
            const value = valueResolvers[column] ? valueResolvers[column](params.row) : params.row[column];
            return <>{renderer({ entity: collectionField.objectTypeName, field: column, row: params.row, value, gridParams: params })}</>;
          };
        }
      }
      return columnDef;
    });

    if (isEditMode) {
      baseColumns.push({
        field: 'actions',
        headerName: resolveLabel(["collection.actions.column"], { entity: collectionField.objectTypeName }, "Actions"),
        width: 100, sortable: false, filterable: false, disableColumnMenu: true,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={resolveLabel(["collection.actions.edit"], { entity: collectionField.objectTypeName }, "Edit")}>
              <IconButton size="small" onClick={() => handleEditItem(params.row)}><EditIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title={resolveLabel(["collection.actions.delete"], { entity: collectionField.objectTypeName }, "Delete")}>
              <IconButton size="small" color="error" onClick={() => handleDeleteItem(params.row)}><DeleteIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Box>
        ),
      });
    }
    return baseColumns;
  }, [collectionField.objectTypeName, collectionField.name, resolveLabel, valueResolvers, isEditMode, handleEditItem, handleDeleteItem, displayColumns, getFieldInfo, renderStateMachineValue]);

  const handlePaginationModelChange = (newModel: GridPaginationModel) => {
    if (newModel.pageSize !== rowsPerPage) { setRowsPerPage(newModel.pageSize); setPage(0); }
    else if (newModel.page !== page) { setPage(newModel.page); }
  };

  const sectionLabel = resolveLabel([`${parentEntityType.toLowerCase()}.${collectionField.name}`], { entity: collectionField.objectTypeName }, collectionField.objectTypeName);

  const localeText = React.useMemo(() => {
    const t = (k: string, d: string) => resolveLabel([`grid.${k}`], { entity: collectionField.objectTypeName }, d);
    return {
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
  }, [resolveLabel, collectionField.objectTypeName, locale]);

  const PaginationComponent = React.useMemo(
    () => () => (
      <TablePagination
        component="div" count={totalCount ?? -1} page={page} rowsPerPage={rowsPerPage}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25]}
        labelRowsPerPage={resolveLabel(['grid.pagination.rowsPerPage'], { entity: collectionField.objectTypeName }, 'Rows per page:')}
        labelDisplayedRows={({ from, to, count }: { from: number; to: number; count: number }) => {
          const template = resolveLabel(['grid.pagination.displayedRows'], { entity: collectionField.objectTypeName }, '{from}–{to} de {count}');
          return template.replace('{from}', from.toString()).replace('{to}', to.toString()).replace('{count}', (count !== -1 ? count : `more than ${to}`).toString());
        }}
      />
    ),
    [locale, totalCount, page, rowsPerPage, resolveLabel, collectionField.objectTypeName]
  );

  const queryReady = !!parentEntityId;

  if (!queryReady) {
    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">{sectionLabel}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography color="error">{resolveLabel(['collection.queryError'], { entity: collectionField.objectTypeName }, 'Error: Could not generate collection query')}</Typography>
        </AccordionDetails>
      </Accordion>
    );
  }

  return (
    <Box>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">{sectionLabel}</Typography>
        </AccordionSummary>
        <AccordionDetails>
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <Box sx={{ width: '100%', mb: 3 }}>
            {collectionLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>{resolveLabel(['collection.loading'], { entity: collectionField.objectTypeName }, 'Loading...')}</Typography>
              </Box>
            ) : collectionError ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography color="error">{resolveLabel(['collection.error'], { entity: collectionField.objectTypeName }, 'Error loading collection data')}</Typography>
              </Box>
            ) : (
              <>
                {(isEditMode || parentEntityId === "") && (
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Tooltip title={`${resolveLabel(["collection.button.create"], { entity: collectionField.objectTypeName }, "Add")} ${resolveLabel([getEntityName(collectionField.objectTypeName, 'single')], { entity: collectionField.objectTypeName }, collectionField.objectTypeName)}`}>
                      <IconButton color="primary" size="large" onClick={handleAddItem}>
                        <AddCircleIcon fontSize="large" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                
                {rows.length === 0 && currentState.added.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '200px' }}>
                    <Typography color="text.secondary">{resolveLabel(['collection.noData'], { entity: collectionField.objectTypeName }, 'No data available')}</Typography>
                  </Box>
                ) : (
                  <Paper variant="outlined">
                    <DataGrid
                      key={`collection-datagrid-${locale}`}
                      rows={rows} columns={gridColumns} pagination
                      paginationModel={{ page, pageSize: rowsPerPage }}
                      onPaginationModelChange={handlePaginationModelChange}
                      pageSizeOptions={[5, 10, 25]}
                      rowCount={totalCount}
                      paginationMode="server" sortingMode="server"
                      sortModel={sortModel}
                      onSortModelChange={(model) => {
                        const norm = (Array.isArray(model) ? model : [])
                          .filter((m) => m.field && m.sort)
                          .map((m) => ({ field: String(m.field), sort: m.sort as 'asc' | 'desc' }));
                        setSortModel(norm);
                      }}
                      loading={collectionLoading}
                      localeText={localeText}
                      slots={{ pagination: PaginationComponent }}
                      disableRowSelectionOnClick
                    />
                  </Paper>
                )}
              </>
            )}
          </Box>

          {(isEditMode || parentEntityId === "") && (
            <Box sx={{ mt: 3 }}>
              {currentState.modified.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Modified Items<Chip label={currentState.modified.length} size="small" color="warning" sx={{ ml: 1 }} /></Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead><TableRow>
                        {displayColumns.map(column => (<TableCell key={column}>{resolveLabel([`${collectionField.objectTypeName.toLowerCase()}.${column}`], { entity: collectionField.name, field: column }, column)}</TableCell>))}
                        <TableCell>{resolveLabel(["collection.actions.column"], { entity: collectionField.objectTypeName }, "Actions")}</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {currentState.modified.map((item) => (
                          <TableRow key={item.id}>
                            {displayColumns.map(column => (<TableCell key={column}>{renderCellContent(item, column)}</TableCell>))}
                            <TableCell>
                              <Tooltip title={resolveLabel(["collection.actions.revert"], { entity: collectionField.objectTypeName }, "Revert Changes")}>
                                <IconButton size="small" onClick={() => handleRestoreItem(item)}><RestoreIcon fontSize="small" /></IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {currentState.deleted.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Deleted Items<Chip label={currentState.deleted.length} size="small" color="error" sx={{ ml: 1 }} /></Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead><TableRow>
                        {displayColumns.map(column => (<TableCell key={column}>{resolveLabel([`${collectionField.objectTypeName.toLowerCase()}.${column}`], { entity: collectionField.name, field: column }, column)}</TableCell>))}
                        <TableCell>{resolveLabel(["collection.actions.column"], { entity: collectionField.objectTypeName }, "Actions")}</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {currentState.deleted.map((item) => (
                          <TableRow key={item.id}>
                            {displayColumns.map(column => (<TableCell key={column}>{renderCellContent(item, column)}</TableCell>))}
                            <TableCell>
                              <Tooltip title={resolveLabel(["collection.actions.restore"], { entity: collectionField.objectTypeName }, "Restore")}>
                                <IconButton size="small" onClick={() => handleRestoreItem(item)}><RestoreIcon fontSize="small" /></IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {currentState.added.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Added Items<Chip label={currentState.added.length} size="small" color="success" sx={{ mb: 1 }} /></Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead><TableRow>
                        {displayColumns.map(column => (<TableCell key={column}>{resolveLabel([`${collectionField.objectTypeName.toLowerCase()}.${column}`], { entity: collectionField.name, field: column }, column)}</TableCell>))}
                        <TableCell>{resolveLabel(["collection.actions.column"], { entity: collectionField.objectTypeName }, "Actions")}</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {currentState.added.map((item) => (
                          <TableRow key={item.id}>
                            {displayColumns.map(column => (<TableCell key={column}>{renderCellContent(item, column)}</TableCell>))}
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Tooltip title={resolveLabel(["collection.actions.edit"], { entity: collectionField.objectTypeName }, "Edit")}>
                                  <IconButton size="small" onClick={() => handleEditItem(item)} color="primary"><EditIcon fontSize="small" /></IconButton>
                                </Tooltip>
                                <Tooltip title={resolveLabel(["collection.actions.remove"], { entity: collectionField.objectTypeName }, "Remove")}>
                                  <IconButton size="small" onClick={() => handleDeleteItem(item)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>

    {message && (
      <Alert severity={message.type} sx={{ mt: 2 }} onClose={() => setMessage(null)}>
        {typeof message.message === 'string' ? message.message : message.message}
      </Alert>
    )}

    {editingItem && editFormOpen && (
      <CollectionItemEditForm
        open={editFormOpen}
        onClose={() => { setEditFormOpen(false); setEditingItem(null); setIsAddingNew(false); }}
        item={editingItem}
        collectionFieldName={collectionField.name}
        objectTypeName={collectionField.objectTypeName}
        parentEntityType={parentEntityType}
        onSave={handleSaveEditedItem}
        isAddingNew={isAddingNew}
        parentFormAccess={parentFormAccess}
      />
    )}
  </Box>
  );
}
