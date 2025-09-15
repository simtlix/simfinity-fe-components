"use client";

import * as React from "react";
import { useQuery } from "@apollo/client";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert
} from "@mui/material";
import {
  INTROSPECTION_QUERY,
  SchemaData,
  getTypeByName,
  getListEntityFieldNamesOfType,
  isNumericScalarName,
  isBooleanScalarName,
  isDateTimeScalarName,
  unwrapNamedType,
} from "./lib/introspection";
import { useI18n } from "./lib/i18n";
import ObjectFieldSelector from "./ObjectFieldSelector";
import {
  FormCustomizationState,
  FormCustomizationActions,
  isFieldVisible,
  isFieldEnabled,
  getFieldOrder,
  getCollectionItemFieldCustomization,
  getCollectionItemFieldSize,
  getFormCustomization,
  FormCustomization,
  getCollectionItemOnSubmit,
  FormMessage,
  ParentFormAccess,
} from "./lib/formCustomization";
import { CollectionItem } from "./CollectionFieldGrid";

type CollectionItemEditFormProps = {
  open: boolean;
  onClose: () => void;
  item: CollectionItem;
  collectionFieldName: string;
  objectTypeName: string;
  parentEntityType: string;
  onSave: (updatedItem: CollectionItem) => void;
  isAddingNew?: boolean; // Indicates if this is a new item being added
  parentFormAccess?: ParentFormAccess; // Access to parent form data and actions
};

type FormField = {
  name: string;
  type: string;
  required: boolean;
  value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown };
  error?: string;
  isNumeric: boolean;
  isBoolean: boolean;
  isDate: boolean;
  isList: boolean;
  isEnum: boolean;
  enumValues?: string[];
  isObject: boolean;
  objectTypeName?: string;
  descriptionField?: string;
  descriptionFieldType?: string;
  listQueryName?: string;
  singleQueryName?: string;
  isEmbedded?: boolean;
  embeddedFields?: FormField[];
  isCollection?: boolean;
  collectionObjectTypeName?: string;
  connectionField?: string;
  isStateMachine?: boolean;
};

type FormData = Record<string, FormField>;

export default function CollectionItemEditForm({
  open,
  onClose,
  item,
  collectionFieldName,
  objectTypeName,
  parentEntityType,
  onSave,
  isAddingNew = false,
  parentFormAccess,
}: CollectionItemEditFormProps) {
  const { data: schemaData } = useQuery(INTROSPECTION_QUERY);
  const { resolveLabel } = useI18n();
  const [formData, setFormData] = React.useState<FormData>({} as FormData);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<FormMessage | null>(null);

  // Form customization state
  const [customizationState, setCustomizationState] = React.useState<FormCustomizationState>({
    customization: {},
    fieldVisibility: {},
    fieldEnabled: {},
    fieldOrder: [],
  });

  // Build form fields based on schema
  const formFields = React.useMemo(() => {
    if (!schemaData) return [];
    
    try {
      const schema = schemaData as SchemaData;
      const entityType = getTypeByName(schema, objectTypeName);
      if (!entityType?.fields) return [];
      
      return entityType.fields
        .filter(field => {
          // Exclude ID field (system-generated, not user-editable)
          if (field.name === "id") {
            return false;
          }
          
          // Handle state machine fields based on mode
          const isStateMachineField = field.extensions?.stateMachine === true;
          if (isStateMachineField) {
            if (isAddingNew) {
              console.log(`Field ${field.name}: EXCLUDED - State machine field (create mode)`);
              return false;
            } else {
              console.log(`Field ${field.name}: INCLUDED - State machine field (edit mode, read-only)`);
              return true;
            }
          }
          
          // Exclude connection fields to parent entity
          if (field.name === parentEntityType.toLowerCase() || 
              field.name === parentEntityType.toLowerCase() + 's') {
            return false;
          }
          
          // Exclude collection fields for now (to keep it simple)
          const fieldType = field.type;
          const isList = fieldType.kind === "LIST";
          if (isList) return false;
          
          return true;
        })
        .map(field => {
          const fieldType = field.type;
          const typeName = unwrapNamedType(fieldType);
          const isNonNull = isNonNullField(fieldType);
          const isList = fieldType.kind === "LIST";
          
          // Check if this is an ENUM type
          let current = fieldType as { kind?: string; ofType?: unknown; name?: string };
          while (current && current.kind && (current.kind === "NON_NULL" || current.kind === "LIST")) {
            current = current.ofType as { kind?: string; ofType?: unknown; name?: string };
          }
          const isEnum = current?.kind === "ENUM";
          
          // Check if this is an OBJECT type (non-list)
          const isObject = current?.kind === "OBJECT" && !isList;
          const objectTypeName = isObject && typeName ? typeName : undefined;
          const descriptionField = isObject ? "name" : undefined; // Default to "name" for object fields
          
          // Get object type info if it's an object field
          let descriptionFieldType: string | undefined;
          let listQueryName: string | undefined;
          let singleQueryName: string | undefined;
          
          if (isObject && objectTypeName) {
            // Get description field from schema extensions
            const objectType = getTypeByName(schema, objectTypeName);
            if (objectType?.fields) {
              // Look for common description fields
              const descField = objectType.fields.find(f => 
                f.name === 'name' || f.name === 'title' || f.name === 'description'
              );
              if (descField) {
                descriptionFieldType = unwrapNamedType(descField.type) || undefined;
              }
            }
            
            // Get query names
            const queryNames = getQueryNamesForObjectType(schema, objectTypeName);
            if (queryNames) {
              listQueryName = queryNames.listQueryName;
              singleQueryName = queryNames.singleQueryName;
            }
          }
          
          // Get enum values if it's an enum field
          let enumValues: string[] | undefined;
          if (isEnum && typeName) {
            enumValues = getEnumValues(schema, typeName);
          }
          
          // Get current value from item
          const itemValue = item[field.name];
          let currentValue: string | number | boolean | string[] | null;
          
          if (itemValue !== undefined && itemValue !== null) {
            if (typeof itemValue === 'object') {
              // Handle object fields - extract the ID for non-embedded objects
              if (isObject && 'id' in itemValue) {
                currentValue = itemValue.id as string;
                console.log(`Object field ${field.name}: extracted ID from object:`, currentValue);
              } else {
                // For other object types, use default value
                currentValue = getDefaultValue(typeName || "String", isBooleanScalarName(typeName), isList, isObject);
                console.log(`Object field ${field.name}: using default value for non-ID object:`, currentValue);
              }
            } else {
              // For scalar values, use the item value directly
              currentValue = itemValue as string | number | boolean | string[];
              console.log(`Scalar field ${field.name}: using item value directly:`, currentValue);
            }
          } else {
            // Use default value when item value is undefined or null
            currentValue = getDefaultValue(typeName || "String", isBooleanScalarName(typeName), isList, isObject);
            console.log(`Field ${field.name}: using default value (item value was undefined/null):`, currentValue);
          }
          
          // Debug validated scalar detection
          const isNumeric = isNumericScalarName(typeName);
          const isBoolean = isBooleanScalarName(typeName);
          const isDate = isDateTimeScalarName(typeName);
          
          console.log(`Field ${field.name}: type=${typeName}, isNumeric=${isNumeric}, isBoolean=${isBoolean}, isDate=${isDate}`);
          
          return {
            name: field.name,
            type: typeName || "String",
            required: isNonNull,
            value: currentValue,
            error: undefined,
            isNumeric,
            isBoolean,
            isDate,
            isList,
            isEnum,
            enumValues,
            isObject,
            objectTypeName,
            descriptionField,
            descriptionFieldType,
            listQueryName,
            singleQueryName,
            isEmbedded: false,
            embeddedFields: [],
            isCollection: false,
            collectionObjectTypeName: undefined,
            connectionField: undefined,
            isStateMachine: field.extensions?.stateMachine === true,
          };
        });
    } catch (error) {
      console.error('Error building form fields:', error);
      return [];
    }
  }, [schemaData, objectTypeName, item, parentEntityType, isAddingNew]);

  // Initialize form customization from parent entity
  React.useEffect(() => {
    if (formFields.length > 0) {
      const fieldNames = formFields.map(field => field.name);
      
      // Get the parent entity's customization
      const parentCustomization = getFormCustomization(parentEntityType, "edit");
      
      // Create a flattened customization state for the collection item fields
      const flattenedCustomization: FormCustomization = {};
      
      fieldNames.forEach(fieldName => {
        const collectionItemCustomization = getCollectionItemFieldCustomization(
          parentCustomization || {},
          collectionFieldName,
          objectTypeName,
          fieldName,
          "edit" // We're in edit mode for collection items
        );
        
        if (collectionItemCustomization) {
          flattenedCustomization[fieldName] = collectionItemCustomization;
        }
      });
      
      const newCustomizationState: FormCustomizationState = {
        customization: flattenedCustomization,
        fieldVisibility: {},
        fieldEnabled: {},
        fieldOrder: [],
      };
      
      // Initialize field visibility and enabled state
      fieldNames.forEach(fieldName => {
        const fieldCustomization = flattenedCustomization[fieldName];
        const visible = fieldCustomization?.visible;
        const enabled = fieldCustomization?.enabled;
        
        newCustomizationState.fieldVisibility[fieldName] = typeof visible === 'function' ? true : (visible ?? true);
        newCustomizationState.fieldEnabled[fieldName] = typeof enabled === 'function' ? true : (enabled ?? true);
      });
      
      // Create field order
      const fieldOrder = fieldNames.sort((a, b) => {
        const aCustomization = flattenedCustomization[a];
        const bCustomization = flattenedCustomization[b];
        
        if (aCustomization?.order !== undefined && bCustomization?.order !== undefined) {
          return aCustomization.order - bCustomization.order;
        }
        
        if (aCustomization?.order !== undefined) return -1;
        if (bCustomization?.order !== undefined) return 1;
        
        return 0;
      });
      
      newCustomizationState.fieldOrder = fieldOrder;
      setCustomizationState(newCustomizationState);
    }
  }, [formFields, collectionFieldName, objectTypeName, parentEntityType]);

  // Initialize form data when formFields change
  React.useEffect(() => {
    if (formFields.length > 0) {
      const initialFormData: FormData = {};
      formFields.forEach(field => {
        initialFormData[field.name] = field;
      });
      setFormData(initialFormData);
      console.log('Initialized form data for collection item:', initialFormData);
      console.log('Form fields used for initialization:', formFields.map(f => ({ name: f.name, type: f.type, value: f.value, isNumeric: f.isNumeric, isBoolean: f.isBoolean, isDate: f.isDate })));
    }
  }, [formFields]);

  // Form customization actions
  const customizationActions: FormCustomizationActions = React.useMemo(() => ({
    setFieldData: (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => {
      setFormData(prev => ({
        ...prev,
        [fieldName]: { ...prev[fieldName], value }
      }));
    },
    setFieldVisible: (fieldName: string, visible: boolean) => {
      setCustomizationState(prev => ({
        ...prev,
        fieldVisibility: { ...prev.fieldVisibility, [fieldName]: visible }
      }));
    },
    setFieldEnabled: (fieldName: string, enabled: boolean) => {
      setCustomizationState(prev => ({
        ...prev,
        fieldEnabled: { ...prev.fieldEnabled, [fieldName]: enabled }
      }));
    },
    setFieldOrder: (fieldOrder: string[]) => {
      setCustomizationState(prev => ({
        ...prev,
        fieldOrder
      }));
    },
  }), []);

  // Handle field change
  const handleFieldChange = (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => {
    const field = formFields.find(f => f.name === fieldName);
    if (!field) return;

    console.log(`Field change for ${fieldName}:`, { value, type: typeof value, field });

    // Get field customization
    const fieldCustomization = customizationState.customization[fieldName];
    const customOnChange = fieldCustomization && 'onChange' in fieldCustomization ? fieldCustomization.onChange : undefined;

    if (customOnChange) {
      // Create default parent form access if not provided
      const defaultParentFormAccess: ParentFormAccess = {
        parentFormData: {},
        parentFieldVisibility: {},
        parentFieldEnabled: {},
        setParentFieldData: () => {},
        setParentFieldVisible: () => {},
        setParentFieldEnabled: () => {},
      };

      const result = customOnChange(
        fieldName, 
        value, 
        formData, 
        customizationActions.setFieldData, 
        customizationActions.setFieldVisible, 
        customizationActions.setFieldEnabled,
        parentFormAccess || defaultParentFormAccess
      );
      customizationActions.setFieldData(fieldName, result.value as string | number | boolean | string[] | null);
      
      // Handle error if any
      if (result.error) {
        setFormData(prev => ({
          ...prev,
          [fieldName]: { ...prev[fieldName], error: result.error }
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [fieldName]: { ...prev[fieldName], error: undefined }
        }));
      }
    } else {
      // For object fields, store the complete object data
      if (field.isObject && typeof value === 'object' && value !== null && 'id' in value) {
        customizationActions.setFieldData(fieldName, value);
      } else {
        customizationActions.setFieldData(fieldName, value);
      }
    }
    
    console.log(`Updated formData for ${fieldName}:`, formData[fieldName]);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Build updated item data
      const updatedItem: CollectionItem = {
        ...item,
        __status: isAddingNew ? 'added' as const : 'modified' as const,
        __originalData: item.__originalData || { ...item },
      };
      
      console.log('Initial updated item:', updatedItem);
      console.log('Item being processed:', item);
      console.log('Form fields being processed:', formFields);
      console.log('Form data being processed:', formData);
      console.log('Is adding new:', isAddingNew);
      console.log('Parent entity type:', parentEntityType);
      console.log('Collection field name:', collectionFieldName);
      console.log('Object type name:', objectTypeName);
      console.log('Schema data available:', !!schemaData);
      console.log('Form customization state:', customizationState);
      console.log('Form customization actions:', customizationActions);
      console.log('Parent form access:', parentFormAccess);
      console.log('Form field types:', formFields.map(f => ({ name: f.name, type: f.type, isNumeric: f.isNumeric, isBoolean: f.isBoolean, isDate: f.isDate, isObject: f.isObject, isEnum: f.isEnum })));
      console.log('Form field values:', formFields.map(f => ({ name: f.name, value: f.value, type: typeof f.value })));
      console.log('Form data values:', Object.keys(formData).map(key => ({ key, value: formData[key]?.value, type: typeof formData[key]?.value })));
      console.log('Item values:', Object.keys(item).map(key => ({ key, value: item[key], type: typeof item[key] })));
      console.log('Item __status:', item.__status);
      console.log('Item __originalData:', item.__originalData);

      // Add form field values
      console.log('Processing form fields for submission:', formFields.map(f => ({ name: f.name, type: f.type, isNumeric: f.isNumeric, isBoolean: f.isBoolean, isDate: f.isDate })));
      console.log('Current formData:', formData);
      
      formFields.forEach(field => {
        // Skip state machine fields from mutation data
        if (field.isStateMachine) {
          console.log(`Skipping state machine field ${field.name} from mutation data`);
          return;
        }
        
        const formField = formData[field.name];
        console.log(`Processing field ${field.name}:`, { field, formField });
        
        if (formField) {
          // For object fields, extract the ID for submission
          if (field.isObject && typeof formField.value === 'object' && formField.value !== null && 'id' in formField.value) {
            updatedItem[field.name] = (formField.value as { id: string; [key: string]: unknown });
            console.log(`Object field ${field.name}: stored object with ID:`, formField.value);
          } else {
            updatedItem[field.name] = formField.value;
            console.log(`Scalar field ${field.name}: stored value:`, formField.value, 'type:', typeof formField.value);
          }
        } else {
          console.warn(`No form field data found for ${field.name}`);
        }
      });
      
      console.log('Final updated item:', updatedItem);
      console.log('Item before processing:', item);

      // For added items, ensure the connection field remains null
      if (isAddingNew) {
        // Find the connection field name (usually the parent entity type in lowercase)
        const connectionFieldName = parentEntityType.toLowerCase();
        if (connectionFieldName in updatedItem) {
          updatedItem[connectionFieldName] = null;
          console.log(`Set connection field ${connectionFieldName} to null for new item`);
        }
      }

      // Get onSubmit callback for collection item
      const parentCustomization = getFormCustomization(parentEntityType, "edit");
      const onSubmitCallback = getCollectionItemOnSubmit(
        parentCustomization || {},
        collectionFieldName,
        objectTypeName,
        isAddingNew ? "create" : "edit"
      );
      
      console.log('Collection item onSubmit callback:', { onSubmitCallback: !!onSubmitCallback, parentCustomization: !!parentCustomization });

      // Execute onSubmit callback if available
      if (onSubmitCallback) {
        try {
          console.log('Executing onSubmit callback...');
          // Create default parent form access if not provided
          const defaultParentFormAccess: ParentFormAccess = {
            parentFormData: {},
            parentFieldVisibility: {},
            parentFieldEnabled: {},
            setParentFieldData: () => {},
            setParentFieldVisible: () => {},
            setParentFieldEnabled: () => {},
          };

          const shouldContinue = await onSubmitCallback(
            updatedItem,
            customizationActions.setFieldData,
            formData,
            customizationActions.setFieldVisible,
            customizationActions.setFieldEnabled,
            setMessage,
            parentFormAccess || defaultParentFormAccess
          );

          // If callback explicitly returns false, stop form submission
          if (shouldContinue === false) {
            console.log('Collection item submission cancelled by onSubmit callback');
            return;
          }
          
          console.log('onSubmit callback completed successfully');
        } catch (onSubmitError) {
          console.error('Error in collection item onSubmit callback:', onSubmitError);
          // If onSubmit throws an error, stop form submission
          return;
        }
      } else {
        console.log('No onSubmit callback, proceeding with default submission');
      }

      console.log('Calling onSave with updated item:', updatedItem);
      onSave(updatedItem);
      onClose();
    } catch (err: unknown) {
      console.error('Error in form submission:', err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get field label
  const getFieldLabel = (fieldName: string): string => {
    return resolveLabel([`${objectTypeName}.${fieldName}`], { entity: objectTypeName, field: fieldName }, fieldName);
  };

  // Render form field
  const renderFormField = (field: FormField) => {
    console.log(`Rendering field ${field.name}:`, { field, formData: formData[field.name] });
    
    const fieldSize = getCollectionItemFieldSize(
      collectionFieldName,
      objectTypeName,
      field.name,
      getFormCustomization(parentEntityType, "edit") || {},
      "edit", // We're in edit mode for collection items
      { xs: 12, sm: 6, md: 4 }
    );
    const isVisible = isFieldVisible(field.name, customizationState, field.value, formData);
    const isEnabled = isFieldEnabled(field.name, customizationState, field.value, formData);
    const isStateMachineField = field.isStateMachine === true;

    if (!isVisible) return null;

    const fieldLabel = getFieldLabel(field.name);
    const formField = formData[field.name] || field;
    
    console.log(`Field ${field.name} formField:`, formField);

    // Check for custom renderer
    const fieldCustomization = getCollectionItemFieldCustomization(
      getFormCustomization(parentEntityType, "edit") || {},
      collectionFieldName,
      objectTypeName,
      field.name,
      "edit"
    );
    const customRenderer = fieldCustomization?.customRenderer;
    
    if (customRenderer) {
      return (
        <Grid key={field.name} size={fieldSize}>
          {customRenderer(
            field,
            customizationActions,
            (fieldName, value) => {
              console.log(`Custom renderer field ${fieldName} onChange:`, { value, type: typeof value });
              handleFieldChange(fieldName, value);
            },
            !isEnabled || isStateMachineField
          )}
        </Grid>
      );
    }

    if (field.isObject && field.objectTypeName && field.descriptionField && field.listQueryName && field.singleQueryName) {
      return (
        <Grid key={field.name} size={fieldSize}>
          <ObjectFieldSelector
            label={fieldLabel}
            value={formField.value as string | null}
            onChange={(value) => {
              console.log(`Object field ${field.name} onChange:`, { value, type: typeof value });
              handleFieldChange(field.name, value);
            }}
            error={formField.error}
            required={field.required}
            disabled={!isEnabled || isStateMachineField}
            objectTypeName={field.objectTypeName}
            descriptionField={field.descriptionField}
            descriptionFieldType={field.descriptionFieldType || "String"}
            listQueryName={field.listQueryName}
            singleQueryName={field.singleQueryName}
          />
        </Grid>
      );
    }

    if (field.isEnum && field.enumValues) {
      return (
        <Grid key={field.name} size={fieldSize}>
          <FormControl fullWidth error={!!formField.error} required={field.required} disabled={!isEnabled || isStateMachineField}>
            <InputLabel>{fieldLabel}</InputLabel>
            <Select
              value={formField.value || ""}
              onChange={(e) => {
                const value = e.target.value;
                console.log(`Enum field ${field.name} onChange:`, { value, type: typeof value });
                handleFieldChange(field.name, value);
              }}
              label={fieldLabel}
            >
              {field.enumValues.map((enumValue) => (
                <MenuItem key={enumValue} value={enumValue}>
                  {enumValue}
                </MenuItem>
              ))}
            </Select>
            {formField.error && (
              <FormHelperText error>{formField.error}</FormHelperText>
            )}
          </FormControl>
        </Grid>
      );
    }

    if (field.isBoolean) {
      return (
        <Grid key={field.name} size={fieldSize}>
          <FormControl error={!!formField.error}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formField.value as boolean || false}
                  onChange={(e) => {
                    const value = e.target.checked;
                    console.log(`Boolean field ${field.name} onChange:`, { value, type: typeof value });
                    handleFieldChange(field.name, value);
                  }}
                  disabled={!isEnabled || isStateMachineField}
                />
              }
              label={fieldLabel}
            />
            {formField.error && (
              <FormHelperText error>{formField.error}</FormHelperText>
            )}
          </FormControl>
        </Grid>
      );
    }

    if (field.isDate) {
      // Convert DateTime string to date string for input display
      const getDateInputValue = (dateTimeValue: string | null | undefined): string => {
        if (!dateTimeValue) return "";
        try {
          // If it's already a date string (YYYY-MM-DD), use it directly
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateTimeValue)) {
            return dateTimeValue;
          }
          // If it's a DateTime string, extract the date part
          const date = new Date(dateTimeValue);
          if (isNaN(date.getTime())) return "";
          return date.toISOString().split('T')[0];
        } catch {
          return "";
        }
      };

      // Convert date string to DateTime string for storage
      const convertDateToDateTime = (dateString: string): string => {
        if (!dateString) return "";
        try {
          // Create a date at midnight UTC and convert to ISO string
          const date = new Date(dateString + 'T00:00:00.000Z');
          return date.toISOString();
        } catch {
          return "";
        }
      };

      return (
        <Grid key={field.name} size={fieldSize}>
          <TextField
            fullWidth
            label={fieldLabel}
            type="date"
            value={getDateInputValue(formField.value as string)}
            onChange={(e) => {
              const dateValue = e.target.value;
              console.log(`Date field ${field.name} onChange:`, { dateValue, type: typeof dateValue });
              const dateTimeValue = convertDateToDateTime(dateValue);
              console.log(`Date field ${field.name} converted to DateTime:`, { dateTimeValue });
              handleFieldChange(field.name, dateTimeValue);
            }}
            error={!!formField.error}
            helperText={formField.error}
            required={field.required}
            disabled={!isEnabled || isStateMachineField}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      );
    }

    if (field.isNumeric) {
      return (
        <Grid key={field.name} size={fieldSize}>
          <TextField
            fullWidth
            label={fieldLabel}
            type="number"
            value={formField.value as number || ""}
            onChange={(e) => {
              const value = e.target.value;
              console.log(`Numeric field ${field.name} onChange:`, { value, type: typeof value });
              if (value === "") {
                handleFieldChange(field.name, "");
              } else {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  handleFieldChange(field.name, numValue);
                }
              }
            }}
            error={!!formField.error}
            helperText={formField.error}
            required={field.required}
            disabled={!isEnabled || isStateMachineField}
          />
        </Grid>
      );
    }

    // Default text field
    return (
      <Grid key={field.name} size={fieldSize}>
        <TextField
          fullWidth
          label={fieldLabel}
          value={formField.value as string || ""}
          onChange={(e) => {
            const value = e.target.value;
            console.log(`Text field ${field.name} onChange:`, { value, type: typeof value });
            handleFieldChange(field.name, value);
          }}
          error={!!formField.error}
          helperText={formField.error}
          required={field.required}
          disabled={!isEnabled || isStateMachineField}
        />
      </Grid>
    );
  };

  // Sort fields by order
  const sortedFields = React.useMemo(() => {
    const fieldOrder = getFieldOrder(customizationState);
    return [...formFields].sort((a, b) => {
      const aIndex = fieldOrder.indexOf(a.name);
      const bIndex = fieldOrder.indexOf(b.name);
      return aIndex - bIndex;
    });
  }, [formFields, customizationState]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isAddingNew ? 'Add' : 'Edit'} {resolveLabel([`entity.${objectTypeName}.single`], { entity: objectTypeName }, objectTypeName)}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {sortedFields.map(field => renderFormField(field))}
            </Grid>
          </form>
        </Box>
        {message && (
          <Alert severity={message.type} sx={{ mt: 2 }}>
            {typeof message.message === 'string' ? message.message : message.message}
          </Alert>
        )}
        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : (isAddingNew ? "Add" : "Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Helper function to get query names for an object type
function getQueryNamesForObjectType(schema: SchemaData, objectTypeName: string): { listQueryName: string; singleQueryName: string } | null {
  try {
    const listQueryNames = getListEntityFieldNamesOfType(schema, objectTypeName);
    
    if (listQueryNames.length === 0) {
      console.warn(`No list query found for object type: ${objectTypeName}`);
      return null;
    }
    
    const listQueryName = listQueryNames[0];
    const singleQueryName = objectTypeName;
    
    return { listQueryName, singleQueryName };
  } catch (error) {
    console.error(`Error getting query names for object type ${objectTypeName}:`, error);
    return null;
  }
}

// Helper function to check if a field is non-null (required)
function isNonNullField(typeRef: unknown): boolean {
  const current = typeRef as { kind?: string; ofType?: unknown; name?: string };
  return current?.kind === "NON_NULL";
}

// Helper function to get ENUM values from schema
function getEnumValues(schema: SchemaData, enumTypeName: string): string[] {
  const enumType = schema.__schema.types.find(type => type.name === enumTypeName);
  if (enumType?.kind === "ENUM" && enumType.enumValues) {
    return enumType.enumValues.map(enumValue => enumValue.name);
  }
  return [];
}



// Helper function to get default values
function getDefaultValue(typeName: string, isBoolean: boolean, isList: boolean, isObject: boolean): string | number | boolean | string[] | null {
  if (isObject) return null;
  if (isList) return [];
  if (isBoolean) return false;
  if (isNumericScalarName(typeName)) return 0;
  return "";
}
