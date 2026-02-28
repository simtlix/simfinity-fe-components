import * as React from "react";
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
import { useSimfinityClient } from "./lib/simfinityClient";

type CollectionItemEditFormProps = {
  open: boolean;
  onClose: () => void;
  item: CollectionItem;
  collectionFieldName: string;
  objectTypeName: string;
  parentEntityType: string;
  onSave: (updatedItem: CollectionItem) => void;
  isAddingNew?: boolean;
  parentFormAccess?: ParentFormAccess;
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
  isReadOnly?: boolean;
};

type FormData = Record<string, FormField>;

function isNonNullField(typeRef: unknown): boolean {
  const current = typeRef as { kind?: string; ofType?: unknown; name?: string };
  return current?.kind === "NON_NULL";
}

function getDefaultValue(typeName: string, isBoolean: boolean, isList: boolean, isObject: boolean): string | number | boolean | string[] | null {
  if (isObject) return null;
  if (isList) return [];
  if (isBoolean) return false;
  return "";
}

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
  const client = useSimfinityClient();
  const { resolveLabel } = useI18n();
  const [formData, setFormData] = React.useState<FormData>({} as FormData);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<FormMessage | null>(null);

  const [customizationState, setCustomizationState] = React.useState<FormCustomizationState>({
    customization: {},
    fieldVisibility: {},
    fieldEnabled: {},
    fieldOrder: [],
  });

  const formFields = React.useMemo(() => {
    const fields = client.getFieldsOfType(objectTypeName);
    if (!fields || fields.length === 0) return [];

    return fields
      .filter(field => {
        if (field.name === "id") return false;

        const isStateMachineField = field.extensions?.stateMachine === true;
        if (isStateMachineField) {
          if (isAddingNew) return false;
          return true;
        }

        if (field.name === parentEntityType.toLowerCase() ||
            field.name === parentEntityType.toLowerCase() + 's') {
          return false;
        }

        const rawType = field.rawType as { kind?: string };
        if (rawType?.kind === "LIST") return false;

        return true;
      })
      .map(field => {
        const unwrapped = field.type;
        const typeName = unwrapped.name || "String";
        const isRequired = isNonNullField(field.rawType);
        const rawType = field.rawType as { kind?: string };
        const isList = rawType?.kind === "LIST";
        const isEnum = unwrapped.kind === "ENUM";
        const isObject = unwrapped.kind === "OBJECT" && !isList;
        const objTypeName = isObject && typeName ? typeName : undefined;
        const descriptionField = isObject ? (client.getDisplayField(objectTypeName, field.name) || "name") : undefined;

        let descriptionFieldType: string | undefined;
        let listQueryName: string | undefined;
        let singleQueryName: string | undefined;

        if (isObject && objTypeName) {
          descriptionFieldType = descriptionField
            ? client.getDescriptionFieldType(objTypeName, descriptionField)
            : undefined;
          const queryNames = client.getQueryNamesForType(objTypeName);
          listQueryName = queryNames?.pluralQueryName ?? undefined;
          singleQueryName = queryNames?.singularQueryName ?? objTypeName;
        }

        let enumValues: string[] | undefined;
        if (isEnum) enumValues = client.getEnumValues(typeName);

        const isNumeric = client.isNumericScalar(typeName);
        const isBoolean = client.isBooleanScalar(typeName);
        const isDate = client.isDateTimeScalar(typeName);

        const itemValue = item[field.name];
        let currentValue: FormField["value"];

        if (itemValue !== undefined && itemValue !== null) {
          if (typeof itemValue === 'object') {
            if (isObject && 'id' in (itemValue as Record<string, unknown>)) {
              currentValue = (itemValue as { id: string }).id;
            } else {
              currentValue = getDefaultValue(typeName, isBoolean, isList, isObject);
            }
          } else {
            currentValue = itemValue as string | number | boolean | string[];
          }
        } else {
          currentValue = getDefaultValue(typeName, isBoolean, isList, isObject);
        }

        return {
          name: field.name,
          type: typeName,
          required: isRequired,
          value: currentValue,
          error: undefined,
          isNumeric,
          isBoolean,
          isDate,
          isList,
          isEnum,
          enumValues,
          isObject,
          objectTypeName: objTypeName,
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
          isReadOnly: field.extensions?.readOnly === true,
        };
      });
  }, [client, objectTypeName, item, parentEntityType, isAddingNew]);

  React.useEffect(() => {
    if (formFields.length > 0) {
      const fieldNames = formFields.map(field => field.name);
      const parentCustomization = getFormCustomization(parentEntityType, "edit");
      const flattenedCustomization: FormCustomization = {};

      fieldNames.forEach(fieldName => {
        const collectionItemCustomization = getCollectionItemFieldCustomization(
          parentCustomization || {}, collectionFieldName, objectTypeName, fieldName, "edit"
        );
        if (collectionItemCustomization) flattenedCustomization[fieldName] = collectionItemCustomization;
      });

      const newCustomizationState: FormCustomizationState = {
        customization: flattenedCustomization,
        fieldVisibility: {},
        fieldEnabled: {},
        fieldOrder: [],
      };

      fieldNames.forEach(fieldName => {
        const fieldCustomization = flattenedCustomization[fieldName];
        if (typeof fieldCustomization === 'object' && fieldCustomization !== null) {
          const visible = (fieldCustomization as any).visible;
          const enabled = (fieldCustomization as any).enabled;
          newCustomizationState.fieldVisibility[fieldName] = typeof visible === 'function' ? true : (visible ?? true);
          newCustomizationState.fieldEnabled[fieldName] = typeof enabled === 'function' ? true : (enabled ?? true);
        } else {
          newCustomizationState.fieldVisibility[fieldName] = true;
          newCustomizationState.fieldEnabled[fieldName] = true;
        }
      });

      const fieldOrder = fieldNames.sort((a, b) => {
        const ac = flattenedCustomization[a];
        const bc = flattenedCustomization[b];
        let aOrder: number | undefined;
        let bOrder: number | undefined;
        if (typeof ac === 'object' && ac !== null && 'order' in ac) aOrder = (ac as any).order;
        if (typeof bc === 'object' && bc !== null && 'order' in bc) bOrder = (bc as any).order;
        if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;
        return 0;
      });

      newCustomizationState.fieldOrder = fieldOrder;
      setCustomizationState(newCustomizationState);
    }
  }, [formFields, collectionFieldName, objectTypeName, parentEntityType]);

  React.useEffect(() => {
    if (formFields.length > 0) {
      const initialFormData: FormData = {};
      formFields.forEach(field => { initialFormData[field.name] = field; });
      setFormData(initialFormData);
    }
  }, [formFields]);

  const customizationActions: FormCustomizationActions = React.useMemo(() => ({
    setFieldData: (fieldName: string, value: unknown) => {
      setFormData(prev => ({
        ...prev,
        [fieldName]: { ...prev[fieldName], value: value as FormField["value"] }
      }));
    },
    setFieldVisible: (fieldName: string, visible: boolean) => {
      setCustomizationState(prev => ({ ...prev, fieldVisibility: { ...prev.fieldVisibility, [fieldName]: visible } }));
    },
    setFieldEnabled: (fieldName: string, enabled: boolean) => {
      setCustomizationState(prev => ({ ...prev, fieldEnabled: { ...prev.fieldEnabled, [fieldName]: enabled } }));
    },
    setFieldOrder: (fieldOrder: string[]) => {
      setCustomizationState(prev => ({ ...prev, fieldOrder }));
    },
    setCollectionChanges: () => {},
    setFormMessage: () => {},
    setError: () => {},
  }), []);

  const handleFieldChange = (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => {
    const field = formFields.find(f => f.name === fieldName);
    if (!field) return;

    const fieldCustomization = customizationState.customization[fieldName];
    const customOnChange = (typeof fieldCustomization === 'object' && fieldCustomization !== null && 'onChange' in fieldCustomization) ? (fieldCustomization as any).onChange : undefined;

    if (customOnChange) {
      const defaultParentFormAccess: ParentFormAccess = {
        parentFormData: {}, parentFieldVisibility: {}, parentFieldEnabled: {},
        setParentFieldData: () => {}, setParentFieldVisible: () => {}, setParentFieldEnabled: () => {},
      };
      const result = customOnChange(fieldName, value, formData, customizationActions.setFieldData, customizationActions.setFieldVisible, customizationActions.setFieldEnabled, parentFormAccess || defaultParentFormAccess);
      customizationActions.setFieldData(fieldName, result.value as FormField["value"]);
      if (result.error) {
        setFormData(prev => ({ ...prev, [fieldName]: { ...prev[fieldName], error: result.error } }));
      } else {
        setFormData(prev => ({ ...prev, [fieldName]: { ...prev[fieldName], error: undefined } }));
      }
    } else {
      customizationActions.setFieldData(fieldName, value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const updatedItem: CollectionItem = {
        ...item,
        __status: isAddingNew ? 'added' as const : 'modified' as const,
        __originalData: item.__originalData || { ...item },
      };

      formFields.forEach(field => {
        if (field.isStateMachine || field.isReadOnly) return;
        const formField = formData[field.name];
        if (formField) {
          let fieldValue = formField.value;
          if (field.isNumeric && fieldValue && typeof fieldValue === 'string') fieldValue = Number(fieldValue);
          if (field.isDate && fieldValue && typeof fieldValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fieldValue)) {
            fieldValue = `${fieldValue}T00:00:00.000Z`;
          }
          if (field.isObject && typeof fieldValue === 'object' && fieldValue !== null && 'id' in fieldValue) {
            updatedItem[field.name] = fieldValue;
          } else {
            updatedItem[field.name] = fieldValue;
          }
        }
      });

      if (isAddingNew) {
        const connectionFieldName = parentEntityType.toLowerCase();
        if (connectionFieldName in updatedItem) updatedItem[connectionFieldName] = null;
      }

      const parentCustomization = getFormCustomization(parentEntityType, "edit");
      const onSubmitCallback = getCollectionItemOnSubmit(
        parentCustomization || {}, collectionFieldName, objectTypeName, isAddingNew ? "create" : "edit"
      );

      if (onSubmitCallback) {
        const defaultParentFormAccess: ParentFormAccess = {
          parentFormData: {}, parentFieldVisibility: {}, parentFieldEnabled: {},
          setParentFieldData: () => {}, setParentFieldVisible: () => {}, setParentFieldEnabled: () => {},
        };
        const shouldContinue = await onSubmitCallback(
          updatedItem, customizationActions.setFieldData, formData,
          customizationActions.setFieldVisible, customizationActions.setFieldEnabled,
          setMessage, parentFormAccess || defaultParentFormAccess
        );
        if (shouldContinue === false) return;
      }

      onSave(updatedItem);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getFieldLabel = (fieldName: string): string => {
    return resolveLabel([`${objectTypeName}.${fieldName}`], { entity: objectTypeName, field: fieldName }, fieldName);
  };

  const renderFormField = (field: FormField) => {
    const fieldSize = getCollectionItemFieldSize(
      collectionFieldName, objectTypeName, field.name,
      getFormCustomization(parentEntityType, "edit") || {}, "edit", { xs: 12, sm: 6, md: 4 }
    );
    const isVisible = isFieldVisible(field.name, customizationState, field.value, formData);
    const isEnabled = isFieldEnabled(field.name, customizationState, field.value, formData);
    const isStateMachineField = field.isStateMachine === true;
    const isReadOnlyField = field.isReadOnly === true;

    if (!isVisible) return null;

    const fieldLabel = getFieldLabel(field.name);
    const formField = formData[field.name] || field;

    const fieldCustomization = getCollectionItemFieldCustomization(
      getFormCustomization(parentEntityType, "edit") || {},
      collectionFieldName, objectTypeName, field.name, "edit"
    );
    const customRenderer = fieldCustomization?.customRenderer;

    if (customRenderer) {
      return (
        <Grid key={field.name} size={fieldSize}>
          {customRenderer(field, customizationActions, (fieldName, value) => handleFieldChange(fieldName, value), !isEnabled || isStateMachineField || isReadOnlyField, formData)}
        </Grid>
      );
    }

    if (field.isObject && field.objectTypeName && field.descriptionField && field.listQueryName && field.singleQueryName) {
      return (
        <Grid key={field.name} size={fieldSize}>
          <ObjectFieldSelector
            label={fieldLabel} value={formField.value as string | null}
            onChange={(value) => handleFieldChange(field.name, value)}
            error={formField.error} required={field.required}
            disabled={!isEnabled || isStateMachineField || isReadOnlyField}
            objectTypeName={field.objectTypeName} descriptionField={field.descriptionField}
            descriptionFieldType={field.descriptionFieldType || "String"}
            listQueryName={field.listQueryName} singleQueryName={field.singleQueryName}
          />
        </Grid>
      );
    }

    if (field.isEnum && field.enumValues) {
      return (
        <Grid key={field.name} size={fieldSize}>
          <FormControl fullWidth error={!!formField.error} required={field.required} disabled={!isEnabled || isStateMachineField || isReadOnlyField}>
            <InputLabel>{fieldLabel}</InputLabel>
            <Select value={formField.value || ""} onChange={(e) => handleFieldChange(field.name, e.target.value)} label={fieldLabel}>
              {field.enumValues.map((ev) => (<MenuItem key={ev} value={ev}>{ev}</MenuItem>))}
            </Select>
            {formField.error && <FormHelperText error>{formField.error}</FormHelperText>}
          </FormControl>
        </Grid>
      );
    }

    if (field.isBoolean) {
      return (
        <Grid key={field.name} size={fieldSize}>
          <FormControl error={!!formField.error}>
            <FormControlLabel
              control={<Checkbox checked={formField.value as boolean || false} onChange={(e) => handleFieldChange(field.name, e.target.checked)} disabled={!isEnabled || isStateMachineField || isReadOnlyField} />}
              label={fieldLabel}
            />
            {formField.error && <FormHelperText error>{formField.error}</FormHelperText>}
          </FormControl>
        </Grid>
      );
    }

    if (field.isDate) {
      const getDateInputValue = (dateTimeValue: string | null | undefined): string => {
        if (!dateTimeValue) return "";
        try {
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateTimeValue)) return dateTimeValue;
          const date = new Date(dateTimeValue);
          if (isNaN(date.getTime())) return "";
          return date.toISOString().split('T')[0];
        } catch { return ""; }
      };

      return (
        <Grid key={field.name} size={fieldSize}>
          <TextField fullWidth label={fieldLabel} type="date"
            value={getDateInputValue(formField.value as string)}
            onChange={(e) => {
              const dv = e.target.value;
              handleFieldChange(field.name, dv ? `${dv}T00:00:00.000Z` : "");
            }}
            error={!!formField.error} helperText={formField.error} required={field.required}
            disabled={!isEnabled || isStateMachineField || isReadOnlyField}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      );
    }

    if (field.isNumeric) {
      return (
        <Grid key={field.name} size={fieldSize}>
          <TextField fullWidth label={fieldLabel} type="number"
            value={formField.value as number || ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") handleFieldChange(field.name, "");
              else { const nv = parseFloat(v); if (!isNaN(nv)) handleFieldChange(field.name, nv); }
            }}
            error={!!formField.error} helperText={formField.error} required={field.required}
            disabled={!isEnabled || isStateMachineField || isReadOnlyField}
          />
        </Grid>
      );
    }

    return (
      <Grid key={field.name} size={fieldSize}>
        <TextField fullWidth label={fieldLabel}
          value={formField.value as string || ""}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          error={!!formField.error} helperText={formField.error} required={field.required}
          disabled={!isEnabled || isStateMachineField || isReadOnlyField}
        />
      </Grid>
    );
  };

  const sortedFields = React.useMemo(() => {
    const fieldOrder = getFieldOrder(customizationState);
    return [...formFields].sort((a, b) => {
      const ai = fieldOrder.indexOf(a.name);
      const bi = fieldOrder.indexOf(b.name);
      return ai - bi;
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
        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : (isAddingNew ? "Add" : "Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
