import * as React from "react";
import { gql, useQuery } from "@apollo/client";
import { 
  Box, 
  CircularProgress, 
  Typography, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Button,
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
  Alert
} from "@mui/material";
import { DataGrid, type GridColDef, type GridPaginationModel } from "@mui/x-data-grid";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RestoreIcon from "@mui/icons-material/Restore";
import AddIcon from "@mui/icons-material/Add";
import { INTROSPECTION_QUERY, SchemaData, getElementTypeNameOfListField, getListEntityFieldNamesOfType, buildSelectionSetForObjectType, ValueResolver, getTypeByName, unwrapNamedType } from "./lib/introspection";
import { resolveColumnRenderer } from "./lib/columnRenderers";
import { useI18n } from "./lib/i18n";
import CollectionItemEditForm from "./CollectionItemEditForm";
import { getFormCustomization, getCollectionOnDelete, FormMessage, ParentFormAccess } from "./lib/formCustomization";

// Types for collection item management
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
  parentFormAccess?: ParentFormAccess; // Access to parent form data and actions
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
  const { data: schemaData } = useQuery(INTROSPECTION_QUERY);
  const { resolveLabel } = useI18n();
  
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
  
  // Helper function to get field information including extensions
  const getFieldInfo = React.useCallback((fieldName: string) => {
    if (!schemaData || !collectionField.objectTypeName) return null;
    
    const entityType = getTypeByName(schemaData as SchemaData, collectionField.objectTypeName);
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
  }, [schemaData, collectionField.objectTypeName]);

  // Helper function to render state machine field values
  const renderStateMachineValue = React.useCallback((value: unknown, entityTypeName: string) => {
    if (value == null) return "";
    
    const stateKey = `stateMachine.${entityTypeName.toLowerCase()}.state.${value}`;
    return resolveLabel([stateKey], { entity: entityTypeName }, String(value));
  }, [resolveLabel]);
  
  // Local state for collection management
  const [localCollectionState, setLocalCollectionState] = React.useState<CollectionFieldState>({
    added: [],
    modified: [],
    deleted: []
  });

  // Edit form state
  const [editFormOpen, setEditFormOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<CollectionItem | null>(null);
  const [isAddingNew, setIsAddingNew] = React.useState(false);
  
  // Message state for delete callbacks
  const [message, setMessage] = React.useState<FormMessage | null>(null);



  // Use provided state or local state
  const currentState = collectionState || localCollectionState;
  const setCurrentState = React.useMemo(() => 
    onCollectionStateChange 
      ? (newState: CollectionFieldState | ((prev: CollectionFieldState) => CollectionFieldState)) => {
          if (typeof newState === 'function') {
            const updatedState = newState(currentState);
            onCollectionStateChange(collectionField.name, updatedState);
          } else {
            onCollectionStateChange(collectionField.name, newState);
          }
        }
      : setLocalCollectionState,
    [onCollectionStateChange, collectionField.name, currentState]
  );

  // Pagination and sorting state
  const [page, setPage] = React.useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = React.useState<number>(5);
  const [sortModel, setSortModel] = React.useState<{ field: string; sort: 'asc' | 'desc' }[]>([]);

  // Build selection set for the collection type using the same logic as EntityTable
  const { selection, columns, valueResolvers, sortFieldByColumn } = React.useMemo(() => {
    const schema = schemaData as SchemaData | undefined;
    if (!schema) {
      return {
        selection: "id",
        columns: ["id"],
        valueResolvers: { id: (r: Record<string, unknown>) => r["id"] } as Record<string, ValueResolver>,
        sortFieldByColumn: {},
      } as const;
    }
    
    const collectionTypeName = getElementTypeNameOfListField(schema, collectionField.objectTypeName);
    if (!collectionTypeName) {
      return {
        selection: "id",
        columns: ["id"],
        valueResolvers: { id: (r: Record<string, unknown>) => r["id"] } as Record<string, ValueResolver>,
        sortFieldByColumn: {},
      } as const;
    }
    
    return { ...buildSelectionSetForObjectType(schema, collectionTypeName), entityTypeName: collectionTypeName } as const;
  }, [schemaData, collectionField.objectTypeName]);

  // Filter out the connection field from display columns
  const displayColumns = React.useMemo(() => {
    return columns.filter(column => column !== collectionField.connectionField);
  }, [columns, collectionField.connectionField]);

  // Generate the collection query with NIN filter for modified/deleted items
  const collectionQuery = React.useMemo(() => {
    if (!schemaData) return null;
    
    // Get the correct list query name for this type
    const listQueryNames = getListEntityFieldNamesOfType(schemaData as SchemaData, collectionField.objectTypeName);
    const listQueryName = listQueryNames[0]; // Use the first available list query name
    
    if (!listQueryName) {
      console.error(`No list query name found for type: ${collectionField.objectTypeName}`);
      return null;
    }
    
    console.log(`CollectionFieldGrid: Using list query name '${listQueryName}' for type '${collectionField.objectTypeName}'`);
    
    // Generate sort block based on sortModel
    const sortBlock = sortModel.length > 0
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
      : `sort: { terms: [{ field: "id", order: ASC }] }`;

    // Build filter to exclude modified and deleted items (but NOT added items)
    const excludeFilter = isEditMode && (currentState.modified.length > 0 || currentState.deleted.length > 0)
      ? (() => {
          const excludeIds = [
            ...currentState.modified.map(item => item.id),
            ...currentState.deleted.map(item => item.id)
            // Note: We do NOT exclude added items since they don't exist in the database yet
          ];
          
          if (excludeIds.length === 0) return '';
          
          return `
            id: { operator: NIN, value: [${excludeIds.map(id => `"${id}"`).join(', ')}] }
          `;
        })()
      : '';

    const queryString = `
      query Get${collectionField.objectTypeName.charAt(0).toUpperCase() + collectionField.objectTypeName.slice(1)}s($parentId: QLValue!, $page: Int!, $size: Int!, $count: Boolean!) {
        ${listQueryName}(
          ${collectionField.connectionField}: { terms: { path: "id", operator: EQ, value: $parentId } }
          ${excludeFilter ? excludeFilter : ''}
          pagination: { page: $page, size: $size, count: $count }
          ${sortBlock}
        ) {
          ${selection}
        }
      }
    `;
    
    try {
      return gql(queryString);
    } catch (error) {
      console.error('Error generating collection query:', error);
      return null;
    }
  }, [collectionField, selection, schemaData, sortModel, sortFieldByColumn, isEditMode, currentState.modified, currentState.deleted]); // Note: currentState.added is intentionally NOT included since added items don't affect the query

  // Execute the collection query
  const { data: collectionData, loading: collectionLoading, error: collectionError } = useQuery(collectionQuery!, {
    variables: {
      parentId: parentEntityId,
      page: page + 1, // Convert to 1-based for GraphQL
      size: rowsPerPage,
      count: true,
    },
    skip: !collectionQuery || !parentEntityId,
  });

  // Log collection query execution
  React.useEffect(() => {
    if (collectionQuery && parentEntityId) {
      console.log(`CollectionFieldGrid: Executing query for ${collectionField.name}`, {
        parentId: parentEntityId,
        page: page + 1,
        size: rowsPerPage,
        excludeIds: [...currentState.modified.map(item => item.id), ...currentState.deleted.map(item => item.id)],
        addedIds: currentState.added.map(item => item.id), // Added items are NOT excluded from query
        query: collectionQuery.loc?.source.body
      });
    }
  }, [collectionQuery, parentEntityId, page, rowsPerPage, collectionField.name, currentState.modified, currentState.deleted, currentState.added]);

  // Process the collection data
  const rows = React.useMemo(() => {
    if (!collectionData || !collectionField.objectTypeName || !schemaData) return [];
    
    // Get the correct list query name for this type
    const listQueryNames = getListEntityFieldNamesOfType(schemaData as SchemaData, collectionField.objectTypeName);
    const listQueryName = listQueryNames[0];
    
    if (!listQueryName) return [];
    
    const items = collectionData[listQueryName] || [];
    
    return items.map((item: Record<string, unknown>) => {
      const processedRow: Record<string, unknown> = { id: item.id };
      
      // Apply value resolvers for each column for display purposes
      columns.forEach(column => {
        if (column !== 'id' && valueResolvers[column]) {
          processedRow[column] = valueResolvers[column](item);
        } else if (column !== 'id') {
          processedRow[column] = item[column];
        }
      });
      
      // Store the original item data for editing (preserving object structure with IDs)
      processedRow.__originalData = item;
      
      return processedRow;
    });
  }, [collectionData, collectionField.objectTypeName, columns, valueResolvers, schemaData]);

  // Get total count
  const totalCount = React.useMemo(() => {
    if (!collectionData || !collectionField.objectTypeName || !schemaData) return 0;
    
    // Get the correct list query name for this type
    const listQueryNames = getListEntityFieldNamesOfType(schemaData as SchemaData, collectionField.objectTypeName);
    const listQueryName = listQueryNames[0];
    
    if (!listQueryName) return 0;
    
    const items = collectionData[listQueryName] || [];
    
    // For now, we'll use the length of returned items
    // In a real implementation, you might want to add a count field to the query
    return items.length;
  }, [collectionData, collectionField.objectTypeName, schemaData]);



  // Collection item management functions
  const handleEditItem = React.useCallback((item: Record<string, unknown>) => {
    // Use the original data for editing to preserve object structure with IDs
    const originalData = item.__originalData as Record<string, unknown>;
    const editingItemData = originalData || item;
    
    console.log('handleEditItem: original item:', item);
    console.log('handleEditItem: original data:', originalData);
    console.log('handleEditItem: editing item data:', editingItemData);
    
    setEditingItem(editingItemData as CollectionItem);
    setIsAddingNew(false); // This is editing an existing item, not adding new
    setEditFormOpen(true);
  }, []);

  const handleDeleteItem = React.useCallback(async (item: Record<string, unknown>) => {
    // Get onDelete callback for collection
    const parentCustomization = getFormCustomization(parentEntityType, "edit");
    const onDeleteCallback = getCollectionOnDelete(
      parentCustomization || {},
      collectionField.name
    );

    // Execute onDelete callback if available
    if (onDeleteCallback) {
      try {
        const shouldContinue = await onDeleteCallback(item, setMessage);

        // If callback explicitly returns false, stop deletion
        if (shouldContinue === false) {
          console.log('Collection item deletion cancelled by onDelete callback');
          return;
        }
      } catch (onDeleteError) {
        console.error('Error in collection onDelete callback:', onDeleteError);
        // If onDelete throws an error, stop deletion
        return;
      }
    }

    // If item was added, remove it completely
    if (currentState.added.some(i => i.id === item.id)) {
      setCurrentState(prev => ({
        ...prev,
        added: prev.added.filter(i => i.id !== item.id)
      }));
      return;
    }

    // If item was modified, move it to deleted
    if (currentState.modified.some(i => i.id === item.id)) {
      const modifiedItem = currentState.modified.find(i => i.id === item.id);
      if (modifiedItem) {
        const deletedItem: CollectionItem = { 
          ...modifiedItem, 
          __status: 'deleted' as CollectionItemStatus 
        };
        setCurrentState(prev => ({
          ...prev,
          modified: prev.modified.filter(i => i.id !== item.id),
          deleted: [...prev.deleted, deletedItem]
        }));
      }
      return;
    }

    // If item is original, move it to deleted
    const deletedItem: CollectionItem = { 
      ...item, 
      __status: 'deleted' as CollectionItemStatus 
    } as CollectionItem;
    setCurrentState(prev => ({
      ...prev,
      deleted: [...prev.deleted, deletedItem]
    }));
  }, [currentState.added, currentState.modified, setCurrentState, parentEntityType, collectionField.name]);

  const handleRestoreItem = React.useCallback((item: CollectionItem) => {
    if (item.__status === 'deleted') {
      // Restore deleted item to original state
      setCurrentState(prev => ({
        ...prev,
        deleted: prev.deleted.filter(i => i.id !== item.id)
      }));
    } else if (item.__status === 'modified') {
      // Restore modified item to original state
      setCurrentState(prev => ({
        ...prev,
        modified: prev.modified.filter(i => i.id !== item.id)
      }));
    }
  }, [setCurrentState]);

  const handleAddItem = React.useCallback(() => {
    // Create a new empty item for the form
    const newItem: CollectionItem = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      __status: 'added',
      // Initialize with empty values for all display columns except id
      ...Object.fromEntries(displayColumns.map(col => [col, col === 'id' ? undefined : '']))
    };

    // Set the editing item and open the form
    setEditingItem(newItem);
    setIsAddingNew(true);
    setEditFormOpen(true);
  }, [displayColumns]);

  // Handle saving edited item
  const handleSaveEditedItem = React.useCallback((updatedItem: CollectionItem) => {
    if (isAddingNew) {
      // This is a new item being added
      const savedItem = {
        ...updatedItem,
        __status: 'added' as const,
        __originalData: { ...updatedItem } // Store current state as original for new items
      };
      
      console.log('handleSaveEditedItem: adding new item:', savedItem);
      
      setCurrentState(prev => ({
        ...prev,
        added: [...prev.added, savedItem]
      }));
    } else {
      // This is an existing item being modified
      const savedItem = {
        ...updatedItem,
        __originalData: updatedItem.__originalData || editingItem?.__originalData
      };
      
      console.log('handleSaveEditedItem: updating existing item:', savedItem);
      
      // Check if the item being edited is an added item
      const isEditingAddedItem = currentState.added.some(i => i.id === updatedItem.id);
      
      if (isEditingAddedItem) {
        // If editing an added item, update it in the added list
        setCurrentState(prev => ({
          ...prev,
          added: prev.added.map(i => i.id === updatedItem.id ? savedItem : i)
        }));
      } else {
        // If editing an existing item, move it to modified list
        setCurrentState(prev => ({
          ...prev,
          modified: [...prev.modified.filter(i => i.id !== updatedItem.id), savedItem]
        }));
      }
    }
    
    setEditFormOpen(false);
    setEditingItem(null);
    setIsAddingNew(false);
  }, [setCurrentState, editingItem, isAddingNew, currentState.added]);

  // Helper function to render cell content with custom renderers
  const renderCellContent = React.useCallback((item: Record<string, unknown>, column: string): React.ReactNode => {
    if (column === 'id') return item[column]?.toString() || '';
    
    // Use the current item data (new value) instead of original data
    const dataToUse = item;
    
    // Get the raw value
    const value = valueResolvers[column] ? valueResolvers[column](dataToUse) : dataToUse[column];
    
    // Check if this is a state machine field
    const fieldInfo = getFieldInfo(column);
    if (fieldInfo?.isStateMachine) {
      const internationalizedValue = renderStateMachineValue(value, collectionField.objectTypeName);
      return <span>{internationalizedValue}</span>;
    }
    
    // Apply custom column renderers if available
    const renderer = resolveColumnRenderer(`${collectionField.objectTypeName}.${column}`);
    if (renderer) {
      return renderer({ 
        entity: collectionField.objectTypeName, 
        field: column, 
        row: dataToUse, 
        value, 
        gridParams: { row: dataToUse, value, field: column, colDef: { field: column } } as { row: Record<string, unknown>; value: unknown; field: string; colDef: { field: string } }
      });
    }
    
    // Fallback to string representation
    return value?.toString() || '';
  }, [valueResolvers, collectionField.objectTypeName, getFieldInfo, renderStateMachineValue]);



  // Build grid columns (moved here after function definitions)
  const gridColumns: GridColDef[] = React.useMemo(() => {
    const baseColumns = displayColumns.map(column => {
      const columnDef: GridColDef = {
        field: column,
        headerName: resolveLabel([`${collectionField.objectTypeName}.${column}`], { entity: collectionField.name, field: column }, column),
        width: 150,
        sortable: true,
        filterable: false, // Disable filtering for now to keep it simple
      };

      // Check if this is a state machine field
      const fieldInfo = getFieldInfo(column);
      if (fieldInfo?.isStateMachine) {
        columnDef.renderCell = (params) => {
          const value = valueResolvers[column] ? valueResolvers[column](params.row) : params.row[column];
          const internationalizedValue = renderStateMachineValue(value, collectionField.objectTypeName);
          return <span>{internationalizedValue}</span>;
        };
      } else {
        // Apply custom column renderers if available
        const renderer = resolveColumnRenderer(`${collectionField.objectTypeName}.${column}`);
        if (renderer) {
          columnDef.renderCell = (params) => {
            const value = valueResolvers[column] ? valueResolvers[column](params.row) : params.row[column];
            return (
              <>{renderer({ 
                entity: collectionField.objectTypeName, 
                field: column, 
                row: params.row, 
                value, 
                gridParams: params 
              })}</>
            );
          };
        }
      }

      return columnDef;
    });

    // Add action column for edit mode
    if (isEditMode) {
      baseColumns.push({
        field: 'actions',
        headerName: 'Actions',
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => handleEditItem(params.row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteItem(params.row)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      });
    }

    return baseColumns;
  }, [collectionField.objectTypeName, collectionField.name, resolveLabel, valueResolvers, isEditMode, handleEditItem, handleDeleteItem, displayColumns, getFieldInfo, renderStateMachineValue]);

  // Handle pagination change
  const handlePaginationModelChange = (newModel: GridPaginationModel) => {
    if (newModel.pageSize !== rowsPerPage) {
      setRowsPerPage(newModel.pageSize);
      setPage(0);
    } else if (newModel.page !== page) {
      setPage(newModel.page);
    }
  };

  console.log(`CollectionFieldGrid: parentEntityType=${parentEntityType}, collectionField.name=${collectionField.name}`);
  // Get section label using proper i18n format
  const sectionLabel = resolveLabel([`${parentEntityType}.${collectionField.name}`], { entity: collectionField.objectTypeName }, collectionField.objectTypeName);

  if (!collectionQuery) {
    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">{sectionLabel}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography color="error">Error: Could not generate collection query</Typography>
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
        <Box sx={{ width: '100%' }}>
          {/* Main collection grid */}
          <Box sx={{ height: 400, width: '100%', mb: 3 }}>
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
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddItem}
                      size="small"
                    >
                      {resolveLabel(["button.create"], { entity: collectionField.objectTypeName }, "Add")} {resolveLabel([getEntityName(collectionField.objectTypeName, 'single')], { entity: collectionField.objectTypeName }, collectionField.objectTypeName)}
                    </Button>
                  </Box>
                )}
                
                {rows.length === 0 && currentState.added.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '200px' }}>
                    <Typography color="text.secondary">{resolveLabel(['collection.noData'], { entity: collectionField.objectTypeName }, 'No data available')}</Typography>
                  </Box>
                ) : (
                  <DataGrid
                    rows={rows}
                    columns={gridColumns}
                    pagination
                    paginationModel={{ page, pageSize: rowsPerPage }}
                    onPaginationModelChange={handlePaginationModelChange}
                    pageSizeOptions={[5, 10, 25]}
                    rowCount={totalCount}
                    paginationMode="server"
                    sortingMode="server"
                    sortModel={sortModel}
                    onSortModelChange={(model) => {
                      const norm = (Array.isArray(model) ? model : [])
                        .filter((m) => m.field && m.sort)
                        .map((m) => ({ field: String(m.field), sort: m.sort as 'asc' | 'desc' }));
                      setSortModel(norm);
                    }}
                    loading={collectionLoading}
                    disableRowSelectionOnClick
                    autoHeight
                  />
                )}
              </>
            )}
          </Box>

          {/* Local state tables for create/edit mode */}
          {(isEditMode || parentEntityId === "") && (
            <Box sx={{ mt: 3 }}>
              {/* Modified items table */}
              {currentState.modified.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Modified Items
                    <Chip 
                      label={currentState.modified.length} 
                      size="small" 
                      color="warning" 
                      sx={{ ml: 1 }} 
                    />
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {displayColumns.map(column => (
                            <TableCell key={column}>
                              {resolveLabel([`${collectionField.objectTypeName}.${column}`], { entity: collectionField.name, field: column }, column)}
                            </TableCell>
                          ))}
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {currentState.modified.map((item) => (
                          <TableRow key={item.id}>
                            {displayColumns.map(column => (
                              <TableCell key={column}>
                                {renderCellContent(item, column)}
                              </TableCell>
                            ))}
                            <TableCell>
                              <Tooltip title="Revert Changes">
                                <IconButton
                                  size="small"
                                  onClick={() => handleRestoreItem(item)}
                                >
                                  <RestoreIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Deleted items table */}
              {currentState.deleted.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Deleted Items
                    <Chip 
                      label={currentState.deleted.length} 
                      size="small" 
                      color="error" 
                      sx={{ ml: 1 }} 
                    />
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {displayColumns.map(column => (
                            <TableCell key={column}>
                              {resolveLabel([`${collectionField.objectTypeName}.${column}`], { entity: collectionField.name, field: column }, column)}
                            </TableCell>
                          ))}
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {currentState.deleted.map((item) => (
                          <TableRow key={item.id}>
                            {displayColumns.map(column => (
                              <TableCell key={column}>
                                {renderCellContent(item, column)}
                              </TableCell>
                            ))}
                            <TableCell>
                              <Tooltip title="Restore">
                                <IconButton
                                  size="small"
                                  onClick={() => handleRestoreItem(item)}
                                >
                                  <RestoreIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Added items table */}
              {currentState.added.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Added Items
                    <Chip 
                      label={currentState.added.length} 
                      size="small" 
                      color="success" 
                      sx={{ mb: 1 }} 
                    />
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {displayColumns.map(column => (
                            <TableCell key={column}>
                              {resolveLabel([`${collectionField.objectTypeName}.${column}`], { entity: collectionField.name, field: column }, column)}
                            </TableCell>
                          ))}
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {currentState.added.map((item) => (
                          <TableRow key={item.id}>
                            {displayColumns.map(column => (
                              <TableCell key={column}>
                                {renderCellContent(item, column)}
                              </TableCell>
                            ))}
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Tooltip title="Edit">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditItem(item)}
                                    color="primary"
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Remove">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteItem(item)}
                                    color="error"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
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

    {/* Message display */}
    {message && (
      <Alert severity={message.type} sx={{ mt: 2 }} onClose={() => setMessage(null)}>
        {typeof message.message === 'string' ? message.message : message.message}
      </Alert>
    )}

    {/* Edit form dialog */}
    {editingItem && editFormOpen && (
      <CollectionItemEditForm
        open={editFormOpen}
        onClose={() => {
          setEditFormOpen(false);
          setEditingItem(null);
          setIsAddingNew(false);
        }}
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
