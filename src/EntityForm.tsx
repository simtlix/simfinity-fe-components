import * as React from "react";
import { getEntityFormCallbacks, EntityFormCallbackActions, FormMessage, CollectionFieldState as FormCustomizationCollectionFieldState, ParentFormAccess, FormStep } from "./lib/formCustomization";
import { getEntityStateMachine, getAvailableStateMachineActions, hasStateMachineSupport } from "./lib/stateMachineRegistry";
import { resolveStateMachineActionLabel } from "./lib/i18n";
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  FormControlLabel,
  Link,
  Paper,
  TextField,
  Typography,
  Alert,
  Snackbar,
  Grid,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Menu,
} from "@mui/material";
import StepsPanel, { variants } from "./StepsPanel";
import { isScalarOrEnum } from "./lib/introspection";
import ObjectFieldSelector from "./ObjectFieldSelector";
import CollectionFieldGrid, { CollectionFieldState, CollectionItem } from "./CollectionFieldGrid";
import { useCollectionState } from "./hooks/useCollectionState";
import { useI18n } from "./lib/i18n";
import FormFieldRenderer from "./FormFieldRenderer";
import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { 
  FormCustomizationState, 
  FormCustomizationActions, 
  createFormCustomizationState,
  getFormCustomization,
  getFieldSize,
  isFieldVisible,
  isFieldEnabled,
  getFieldOrder,
  getEmbeddedFieldCustomization,
  getEmbeddedSectionCustomization,
  getEmbeddedFieldSize,
  getCollectionFieldCustomization
} from "./lib/formCustomization";
import { useSimfinityClient, useEntityById, getSchemaDataCompat } from "./lib/simfinityClient";

type EntityFormProps = {
  listField: string;
  entityId?: string;
  action: "create" | "edit" | "view";
  onNavigate?: (path: string) => void;
  returnTo?: string;
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
  isVirtualTransient?: boolean;
};

type FormData = Record<string, FormField>;

function isNonNullField(typeRef: unknown): boolean {
  const current = typeRef as { kind?: string; ofType?: unknown; name?: string };
  return current?.kind === "NON_NULL";
}

function processEmbeddedObjectFieldsFromClient(
  client: ReturnType<typeof useSimfinityClient>,
  objectTypeName: string,
  parentFieldName: string
): FormField[] {
  const fields = client.getFieldsOfType(objectTypeName);
  if (!fields) return [];

  return fields
    .filter(field => field.name !== "id")
    .map(field => {
      const unwrapped = field.type;
      const typeName = unwrapped.name || "String";
      const actualType = client.getActualScalarType(typeName);
      const isNumeric = client.isNumericScalar(typeName);
      const isBoolean = client.isBooleanScalar(typeName);
      const isDate = client.isDateTimeScalar(typeName);
      const isRequired = isNonNullField(field.rawType);
      const isList = field.rawType && (field.rawType as { kind?: string }).kind === "LIST";
      const isEnum = unwrapped.kind === "ENUM";
      const enumValues = isEnum ? client.getEnumValues(typeName) : undefined;

      return {
        name: `${parentFieldName}.${field.name}`,
        type: actualType || typeName,
        isNumeric,
        isBoolean,
        isDate,
        isList: !!isList,
        isEnum,
        enumValues,
        isObject: false,
        isReadOnly: field.extensions?.readOnly === true,
        required: isRequired,
        value: getDefaultValue(actualType || typeName, isBoolean, !!isList, false),
        error: undefined,
      };
    })
    .filter((field): field is NonNullable<typeof field> => field !== null);
}

export default function EntityForm({ listField, entityId, action, onNavigate, returnTo }: EntityFormProps) { 
  const backPath = returnTo ?? `/entities/${listField}`;
  const navigate = React.useCallback((path: string) => {
    if (onNavigate) { onNavigate(path); }
    else if (typeof window !== 'undefined') { window.location.href = path; }
  }, [onNavigate]);

  const { resolveLabel } = useI18n();
  const client = useSimfinityClient();
  const [formData, setFormData] = React.useState<FormData>({} as FormData);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [formMessage, setFormMessage] = React.useState<FormMessage | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [stateMachineMenuAnchor, setStateMachineMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [stateMachineLoading, setStateMachineLoading] = React.useState<string | null>(null);
  const initialDataLoadedRef = React.useRef(false);

  React.useEffect(() => { initialDataLoadedRef.current = false; }, [entityId]);

  const [customizationState, setCustomizationState] = React.useState<FormCustomizationState>({
    customization: {},
    fieldVisibility: {},
    fieldEnabled: {},
    fieldOrder: [],
  });

  const entityTypeName = React.useMemo(
    () => client.getTypeNameForQuery(listField),
    [client, listField]
  );

  const schemaDataCompat = React.useMemo(
    () => getSchemaDataCompat(client),
    [client]
  );

  const { 
    updateCollectionState, 
    getCollectionState,
    getCollectionChanges,
    resetAllCollectionStates
  } = useCollectionState();

  const formActions = React.useMemo((): EntityFormCallbackActions => ({
    setFieldData: (fieldName: string, value: unknown) => {
      setFormData(prev => ({
        ...prev,
        [fieldName]: { 
          ...prev[fieldName], 
          value: (value === null ? "" : value) as string | number | boolean | string[] | null | { id: string; [key: string]: unknown }
        }
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
      setCustomizationState(prev => ({ ...prev, fieldOrder }));
    },
    setCollectionChanges: (fieldName: string, changes: FormCustomizationCollectionFieldState) => {
      const componentChanges: CollectionFieldState = {
        added: changes.added as CollectionItem[],
        modified: changes.modified as CollectionItem[],
        deleted: changes.deleted as CollectionItem[]
      };
      updateCollectionState(fieldName, componentChanges);
    },
    setFormMessage: (message: FormMessage) => { setFormMessage(message); },
    setError: (errorMessage: string) => { setError(errorMessage); }
  }), [updateCollectionState, setCustomizationState, setFormData, setFormMessage, setError]);

  const getEntityName = React.useCallback((pluralName: string, form: 'single' | 'plural'): string => {
    if (!entityTypeName) return `entity.${pluralName}.${form}`;
    const baseName = entityTypeName.toLowerCase();
    return `entity.${baseName}.${form}`;
  }, [entityTypeName]);

  const parentFormAccess: ParentFormAccess = React.useMemo(() => ({
    parentFormData: formData,
    parentFieldVisibility: customizationState.fieldVisibility,
    parentFieldEnabled: customizationState.fieldEnabled,
    setParentFieldData: formActions.setFieldData,
    setParentFieldVisible: formActions.setFieldVisible,
    setParentFieldEnabled: formActions.setFieldEnabled,
  }), [formData, customizationState.fieldVisibility, customizationState.fieldEnabled, formActions]);

  const formFields = React.useMemo(() => {
    if (!entityTypeName) return [];

    const fields = client.getFieldsOfType(entityTypeName);
    if (!fields || fields.length === 0) return [];

    const filteredFields = fields.filter(field => {
      if (field.name === "id") return false;

      const isStateMachineField = field.extensions?.stateMachine === true;
      if (isStateMachineField && action === "create") return false;
      if (isStateMachineField) return true;

      const rawType = field.rawType as { kind?: string; ofType?: unknown };
      const isList = rawType?.kind === "LIST";

      if (isList) {
        const unwrapped = field.type;
        const underlyingIsScalar = unwrapped.kind && isScalarOrEnum(unwrapped.kind);
        const underlyingIsObject = unwrapped.kind === "OBJECT";
        return !!underlyingIsScalar || !!underlyingIsObject;
      } else {
        const unwrapped = field.type;
        const isScalar = unwrapped.kind && isScalarOrEnum(unwrapped.kind);
        const isObject = unwrapped.kind === "OBJECT";
        const isEmbedded = field.extensions?.relation?.embedded === true;
        return !!isScalar || (!!isObject && !isEmbedded) || (!!isObject && !!isEmbedded);
      }
    });

    const schemaFields = filteredFields.map(field => {
      const unwrapped = field.type;
      const typeName = unwrapped.name || "String";
      const isNumeric = client.isNumericScalar(typeName);
      const isBoolean = client.isBooleanScalar(typeName);
      const isDate = client.isDateTimeScalar(typeName);
      const isRequired = isNonNullField(field.rawType);
      const rawType = field.rawType as { kind?: string };
      const isList = rawType?.kind === "LIST";
      const isEnum = unwrapped.kind === "ENUM";
      const enumValues = isEnum ? client.getEnumValues(typeName) : undefined;

      const isObject = unwrapped.kind === "OBJECT" && !isList;
      const isEmbedded = field.extensions?.relation?.embedded === true;
      const isEmbeddedList = isList && unwrapped.kind === "OBJECT" && isEmbedded;
      const objectTypeName = (isObject || isEmbeddedList) && typeName ? typeName : undefined;
      const descriptionField = isObject
        ? (field.extensions?.relation?.displayField || client.getDisplayField(entityTypeName, field.name) || "name")
        : "name";

      const isCollection = isList && unwrapped.kind === "OBJECT";
      const collectionObjectTypeName = isCollection && typeName ? typeName : undefined;
      let connectionField = isCollection && !isEmbedded && field.extensions?.relation?.connectionField
        ? field.extensions.relation.connectionField
        : undefined;

      if (isCollection && !isEmbedded && !connectionField) {
        connectionField = entityTypeName.toLowerCase();
      }

      const descriptionFieldType = isObject && objectTypeName && descriptionField
        ? client.getDescriptionFieldType(objectTypeName, descriptionField)
        : undefined;

      const queryNames = isObject && objectTypeName ? client.getQueryNamesForType(objectTypeName) : null;
      const listQueryName = queryNames?.pluralQueryName ?? undefined;
      const singleQueryName = queryNames?.singularQueryName ?? objectTypeName;

      const isObjectRequired = isObject && isNonNullField(field.rawType);
      const embeddedFields = isEmbedded && objectTypeName
        ? processEmbeddedObjectFieldsFromClient(client, objectTypeName, field.name)
        : undefined;

      return {
        name: field.name,
        type: typeName || "String",
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
        isEmbedded,
        embeddedFields,
        isCollection,
        collectionObjectTypeName,
        connectionField,
        isStateMachine: field.extensions?.stateMachine === true,
        isReadOnly: field.extensions?.readOnly === true,
        isVirtualTransient: false,
        required: isObject ? isObjectRequired : isRequired,
        value: getDefaultValue(typeName || "String", isBoolean, isList, isObject),
        error: undefined,
      };
    }).filter((field): field is NonNullable<typeof field> => field !== null);

    const customization = getFormCustomization(entityTypeName, action);
    if (customization) {
      const RESERVED = new Set(['mode', 'steps', 'beforeSubmit', 'onSuccess', 'onError']);
      const schemaNames = new Set(schemaFields.map(f => f.name));
      for (const [key, fc] of Object.entries(customization)) {
        if (RESERVED.has(key) || schemaNames.has(key)) continue;
        if (
          typeof fc === 'object' && fc !== null &&
          'transient' in fc && (fc as { transient?: boolean }).transient === true &&
          'customRenderer' in fc
        ) {
          schemaFields.push({
            name: key,
            type: "String",
            isNumeric: false,
            isBoolean: false,
            isDate: false,
            isList: false,
            isEnum: false,
            enumValues: undefined,
            isObject: false,
            objectTypeName: undefined,
            descriptionField: "name",
            descriptionFieldType: undefined,
            listQueryName: undefined,
            singleQueryName: undefined,
            isEmbedded: false,
            embeddedFields: undefined,
            isCollection: false,
            collectionObjectTypeName: undefined,
            connectionField: undefined,
            isStateMachine: false,
            isReadOnly: false,
            isVirtualTransient: true,
            required: false,
            value: null,
            error: undefined,
          });
        }
      }
    }

    return schemaFields;
  }, [client, entityTypeName, action, listField]);

  React.useEffect(() => {
    if (formFields.length > 0 && entityTypeName) {
      const fieldNames = formFields.map(field => field.name);
      const newCustomizationState = createFormCustomizationState(entityTypeName, action, fieldNames);
      setCustomizationState(newCustomizationState);
    }
  }, [formFields, entityTypeName, action]);

  const queriesReady = true;

  const getFieldLabel = (fieldName: string): string => {
    const entityKey = entityTypeName ? entityTypeName.toLowerCase() : listField.slice(0, -1);
    const fieldKey = `${entityKey}.${fieldName}`;
    return resolveLabel([fieldKey, fieldName], { entity: listField, field: fieldName }, fieldName);
  };

  const fieldSelectionString = React.useMemo(() => {
    if (!formFields.length || !entityTypeName) return null;
    const fieldSelections = formFields
      .filter(field => !field.isVirtualTransient && (!field.isCollection || field.isEmbedded))
      .map(field => {
        if (field.isEmbedded && field.embeddedFields?.length) {
          const embeddedFieldNames = field.embeddedFields.map(ef => ef.name.replace(`${field.name}.`, ''));
          return `${field.name} { ${embeddedFieldNames.join(' ')} }`;
        }
        if (field.isObject && field.objectTypeName && field.descriptionField) {
          return `${field.name} { id ${field.descriptionField} }`;
        }
        return field.name;
      });
    return `id ${fieldSelections.join(' ')}`;
  }, [formFields, entityTypeName]);

  const { data: entityData, loading: entityLoading } = useEntityById<Record<string, unknown>>(
    entityTypeName,
    action !== "create" ? entityId : null,
    fieldSelectionString ?? undefined
  );

  React.useEffect(() => {
    if (formFields.length > 0) {
      setFormData(prevData => {
        if (Object.keys(prevData).length === 0 || action === "create") {
          const initialData: FormData = {};
          formFields.forEach(field => { initialData[field.name] = field; });
          return initialData;
        }
        return prevData;
      });
    }
  }, [formFields, action]);

  React.useEffect(() => {
    if (initialDataLoadedRef.current) return;
    
    if (entityData && action !== "create" && formFields.length > 0 && entityTypeName) {
      const entity = entityData as Record<string, unknown>;
      
      if (entity) {
        const updatedData: FormData = {};
        formFields.forEach(field => {
          if (entity[field.name] !== undefined) {
            let fieldValue = entity[field.name];
            
            if (field.isObject && !field.isEmbedded && fieldValue && typeof fieldValue === 'object' && 'id' in (fieldValue as Record<string, unknown>)) {
              fieldValue = (fieldValue as { id: string }).id;
            }
            
            updatedData[field.name] = { ...field, value: fieldValue as FormField["value"] };
            
            if (field.isEmbedded && field.embeddedFields && fieldValue && typeof fieldValue === 'object') {
              field.embeddedFields.forEach(embeddedField => {
                const embeddedFieldName = embeddedField.name.replace(`${field.name}.`, '');
                const embeddedFieldValue = (fieldValue as Record<string, unknown>)[embeddedFieldName];
                
                if (embeddedFieldValue !== undefined) {
                  updatedData[embeddedField.name] = { ...embeddedField, value: embeddedFieldValue as FormField["value"] };
                } else {
                  updatedData[embeddedField.name] = embeddedField;
                }
              });
            }
          } else {
            updatedData[field.name] = field;
          }
        });
        setFormData(updatedData);
        initialDataLoadedRef.current = true;
      }
    }
  }, [entityData, entityTypeName, action, formFields, listField]);

  const handleFieldChange = (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }, error?: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], value: value === null ? "" : value, error },
    }));
  };

  const handleEmbeddedFieldChange = (parentFieldName: string, embeddedFieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }, error?: string) => {
    const fullFieldName = `${parentFieldName}.${embeddedFieldName}`;
    setFormData(prev => ({
      ...prev,
      [fullFieldName]: { ...prev[fullFieldName], value: value === null ? "" : value, error },
    }));
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const newFormData = { ...formData };

    const validateField = (field: FormField, fieldData: FormField | undefined): boolean => {
      if (!fieldData) return true;
      const fieldValue = fieldData.value;
      let fieldValid = true;

      if (field.isEmbedded && field.embeddedFields) {
        field.embeddedFields.forEach(embeddedField => {
          const embeddedFieldData = formData[embeddedField.name];
          if (!validateField(embeddedField, embeddedFieldData)) fieldValid = false;
        });
      } else {
        if (field.required && (fieldValue === "" || fieldValue === null || fieldValue === undefined)) {
          newFormData[fieldData.name] = { ...fieldData, error: resolveLabel(["form.required"], { entity: listField }, "This field is required") };
          fieldValid = false;
        }
        if (field.isNumeric && typeof fieldValue === "string" && isNaN(Number(fieldValue))) {
          newFormData[fieldData.name] = { ...fieldData, error: resolveLabel(["form.invalidNumber"], { entity: listField }, "Must be a valid number") };
          fieldValid = false;
        }
        if (field.isDate && typeof fieldValue === "string") {
          if (isNaN(new Date(String(fieldValue)).getTime())) {
            newFormData[fieldData.name] = { ...fieldData, error: resolveLabel(["form.invalidDate"], { entity: listField }, "Must be a valid date") };
            fieldValid = false;
          }
        }
        if (field.isObject && !field.isEmbedded && field.required && (!fieldValue || fieldValue === "" || fieldValue === null)) {
          newFormData[fieldData.name] = { ...fieldData, error: resolveLabel(["form.required"], { entity: listField }, "This field is required") };
          fieldValid = false;
        }
        if (fieldData.error && fieldData.error !== "") {
          newFormData[fieldData.name] = { ...fieldData, error: undefined };
        }
      }
      return fieldValid;
    };

    formFields.forEach(field => {
      if (!validateField(field, formData[field.name])) isValid = false;
    });

    setFormData(newFormData);
    return isValid;
  };

  const buildTransformedInput = React.useCallback((fd: FormData, collectionChanges?: Record<string, CollectionFieldState>): Record<string, unknown> => {
    if (!entityTypeName) return {};

    const rawInput: Record<string, unknown> = {};
    const transientFields: string[] = [];
    const skipFields: string[] = [];

    formFields.forEach(field => {
      const fieldCustomization = customizationState.customization[field.name];
      const isTransient = typeof fieldCustomization === 'object' && fieldCustomization !== null && 'transient' in fieldCustomization && (fieldCustomization as { transient?: boolean }).transient === true;
      if (isTransient) { transientFields.push(field.name); return; }

      if ((field.isCollection && !field.isEmbedded) || field.isStateMachine || field.isReadOnly) {
        skipFields.push(field.name);
        return;
      }

      if (field.isEmbedded && field.embeddedFields) {
        if (field.isList) {
          const directValue = fd[field.name]?.value;
          if (directValue !== undefined && directValue !== null) {
            rawInput[field.name] = directValue;
          }
        } else {
          const embeddedData: Record<string, unknown> = {};
          field.embeddedFields.forEach(ef => {
            if (ef.isReadOnly) return;
            const efName = ef.name.replace(`${field.name}.`, '');
            embeddedData[efName] = fd[ef.name]?.value;
          });
          rawInput[field.name] = embeddedData;
        }
      } else if (field.isObject) {
        const currentValue = fd[field.name]?.value;
        if (currentValue && typeof currentValue === 'object' && 'id' in currentValue) {
          rawInput[field.name] = currentValue;
        } else if (typeof currentValue === 'string' && currentValue) {
          rawInput[field.name] = { id: currentValue };
        }
      } else {
        rawInput[field.name] = fd[field.name]?.value;
      }
    });

    const transformedData = client.transformInput(entityTypeName, rawInput, {
      skipFields,
      transientFields,
      mode: action === "create" ? "create" : "update",
    });

    if (collectionChanges) {
      for (const [fieldName, changes] of Object.entries(collectionChanges)) {
        const field = formFields.find(f => f.name === fieldName);
        if (!field?.isCollection || !field.collectionObjectTypeName) continue;

        const delta = {
          added: changes.added || [],
          updated: changes.modified || [],
          deleted: changes.deleted || [],
        };

        if (delta.added.length > 0 || delta.updated.length > 0 || delta.deleted.length > 0) {
          transformedData[fieldName] = client.transformCollectionDelta(
            field.collectionObjectTypeName,
            delta,
            { connectionField: field.connectionField ?? null }
          );
        }
      }
    }

    return transformedData;
  }, [client, entityTypeName, formFields, action, customizationState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!entityTypeName) return;

    const callbacks = getEntityFormCallbacks(entityTypeName, action);
    const callbackActions = formActions;

    setLoading(true);
    setError(null);
    setFormMessage(null);

    try {
      const collectionChanges = getCollectionChanges();
      const transformedData = buildTransformedInput(formData, collectionChanges);

      if (callbacks?.beforeSubmit) {
        const shouldContinue = await callbacks.beforeSubmit(formData, collectionChanges as Record<string, FormCustomizationCollectionFieldState>, transformedData, callbackActions);
        if (shouldContinue === false) return;
      }

      let result: unknown;

      if (action === "create") {
        result = await client.add(entityTypeName, transformedData, fieldSelectionString ?? undefined);
      } else if (action === "edit") {
        result = await client.update(entityTypeName, entityId!, transformedData, fieldSelectionString ?? undefined);
      }

      resetAllCollectionStates();

      let successResult;
      if (callbacks?.onSuccess) {
        try { successResult = await callbacks.onSuccess(result, callbackActions); }
        catch (e) { console.error('Error in onSuccess callback:', e); }
      }

      if (successResult) {
        if (successResult.message) {
          setSuccessMessage(typeof successResult.message === 'string' ? successResult.message : 'Success');
        }
        if (successResult.navigateTo) {
          setTimeout(() => navigate(successResult.navigateTo!), 1000);
        } else if (successResult.action) {
          successResult.action();
        } else {
          setTimeout(() => navigate(backPath), 1500);
        }
      } else {
        const defaultMessage = action === "create" 
          ? resolveLabel(["form.successCreated"], { entity: listField }, "Entity created successfully!")
          : resolveLabel(["form.successUpdated"], { entity: listField }, "Entity updated successfully!");
        setSuccessMessage(defaultMessage);
        setTimeout(() => navigate(backPath), 1500);
      }
    } catch (err: unknown) {
      if (callbacks?.onError) {
        try { await callbacks.onError(err, formData, callbackActions); return; }
        catch (e) { console.error('Error in onError callback:', e); }
      }
      setError(err instanceof Error ? err.message : resolveLabel(["form.errorOccurred"], { entity: listField }, "An error occurred"));
    } finally {
      setLoading(false);
    }
  };

  const handleStateMachineAction = async (actionName: string) => {
    if (!entityTypeName || !entityId) return;

    const stateMachineConfig = getEntityStateMachine(entityTypeName);
    if (!stateMachineConfig) return;

    const smAction = stateMachineConfig.actions[actionName];
    if (!smAction) return;

    setStateMachineLoading(actionName);
    setStateMachineMenuAnchor(null);

    const collectionChanges = getCollectionChanges();
    const transformedData = buildTransformedInput(formData, collectionChanges);

    try {
      if (smAction.onBeforeSubmit) {
        const result = await smAction.onBeforeSubmit(formData, collectionChanges as Record<string, FormCustomizationCollectionFieldState>, { id: entityId, ...transformedData }, formActions);
        if (!result.shouldProceed) {
          if (result.error) setError(result.error);
          return;
        }
      }

      const result = await client.transition(entityTypeName, smAction.mutation, entityId, transformedData, `id state`);

      if (smAction.onSuccess) {
        await smAction.onSuccess(result, formData, collectionChanges as Record<string, FormCustomizationCollectionFieldState>, transformedData, formActions);
      }

      resetAllCollectionStates();
    } catch (err) {
      if (smAction.onError) {
        await smAction.onError(err as Error, formData, collectionChanges as Record<string, FormCustomizationCollectionFieldState>, transformedData, formActions);
      } else {
        setError(`Failed to ${actionName} entity: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      setStateMachineLoading(null);
    }
  };

  const handleStateMachineMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setStateMachineMenuAnchor(event.currentTarget);
  };

  const handleStateMachineMenuClose = () => {
    setStateMachineMenuAnchor(null);
  };

  const renderEmbeddedSection = (field: FormField, enabled: boolean = true) => {
    if (!field.isEmbedded || !field.embeddedFields) return null;
    
    const sectionLabel = getFieldLabel(field.name);
    const sectionCustomization = getEmbeddedSectionCustomization(customizationState.customization, field.name);
    const sectionSize = sectionCustomization?.size || { xs: 12, sm: 12, md: 12 };
    const sectionVisible = sectionCustomization?.visible;
    const sectionEnabled = sectionCustomization?.enabled;
    
    const isSectionVisible = typeof sectionVisible === 'function' 
      ? sectionVisible(field.name, field.value, formData) : (sectionVisible ?? true);
    const isSectionEnabled = typeof sectionEnabled === 'function'
      ? sectionEnabled(field.name, field.value, formData) : (sectionEnabled ?? true);
    
    if (!isSectionVisible) return null;

    const customEmbeddedRenderer = sectionCustomization?.customEmbeddedRenderer;
    if (customEmbeddedRenderer) {
      return (
        <Grid key={field.name} size={sectionSize}>
          {customEmbeddedRenderer(field, formActions, handleEmbeddedFieldChange, action === "view" || !isSectionEnabled || !enabled, formData)}
        </Grid>
      );
    }
    
    return (
      <Grid key={field.name} size={sectionSize}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{sectionLabel}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {field.embeddedFields.map(embeddedField => {
                const currentValue = formData[embeddedField.name]?.value;
                const embeddedFieldName = embeddedField.name.replace(`${field.name}.`, '');
                const fieldCustomization = getEmbeddedFieldCustomization(customizationState.customization, field.name, embeddedFieldName);
                const fieldSize = getEmbeddedFieldSize(field.name, embeddedFieldName, customizationState.customization);
                
                const fieldForRenderer = {
                  name: embeddedFieldName,
                  type: embeddedField.type,
                  isNonNull: embeddedField.required,
                  isList: embeddedField.isList,
                  extensions: { embedded: true, readOnly: embeddedField.isReadOnly }
                };
                
                return (
                  <Grid key={embeddedField.name} size={fieldSize}>
                    <FormFieldRenderer
                      field={fieldForRenderer}
                      value={currentValue !== undefined ? currentValue : embeddedField.value}
                      onChange={(fieldName, value) => {
                        const customOnChange = fieldCustomization?.onChange;
                        if (customOnChange) {
                          const typedValue = value as string | number | boolean | string[] | null;
                          const result = customOnChange(embeddedFieldName, typedValue, formData, formActions.setFieldData, formActions.setFieldVisible, formActions.setFieldEnabled);
                          handleEmbeddedFieldChange(field.name, embeddedFieldName, result.value as string | number | boolean | string[] | null, result.error);
                        } else {
                          handleEmbeddedFieldChange(field.name, embeddedFieldName, value as string | number | boolean | string[] | null);
                        }
                      }}
                      error={embeddedField.error}
                      disabled={action === "view" || !isSectionEnabled || !enabled}
                      schemaData={schemaDataCompat}
                      entityTypeName={entityTypeName || ''}
                      customizationState={customizationState}
                      parentFieldPath={field.name}
                      isEmbedded={true}
                      hideIdField={true}
                    />
                  </Grid>
                );
              })}
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Grid>
    );
  };

  const renderField = (field: FormField & { onChange?: (value: string | number | boolean | string[] | null) => void }, enabled: boolean = true) => {
    const fieldLabel = getFieldLabel(field.name);
    const isViewMode = action === "view";
    const isStateMachineField = field.isStateMachine === true;
    const isReadOnlyField = field.isReadOnly === true;

    const fieldCustomization = customizationState.customization[field.name];
    const customOnChange = (typeof fieldCustomization === 'object' && fieldCustomization !== null && 'onChange' in fieldCustomization) ? (fieldCustomization as any).onChange : undefined;
    const customRenderer = (typeof fieldCustomization === 'object' && fieldCustomization !== null && 'customRenderer' in fieldCustomization) ? (fieldCustomization as any).customRenderer : undefined;

    if (customRenderer) {
      return (customRenderer as (field: FormField, actions: FormCustomizationActions, handler: (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => void, disabled: boolean, formData: Record<string, unknown>) => React.ReactElement)(
        field, formActions,
        (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => handleFieldChange(fieldName, value),
        isViewMode || !enabled || isStateMachineField || isReadOnlyField, formData
      );
    }

    const onChange = customOnChange 
      ? (value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => {
          const result = customOnChange(field.name, value, formData, formActions.setFieldData, formActions.setFieldVisible, formActions.setFieldEnabled, undefined);
          handleFieldChange(field.name, result.value as string | number | boolean | string[] | null | { id: string; [key: string]: unknown }, result.error);
        }
      : ((value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => handleFieldChange(field.name, value));

    if (field.isObject && field.objectTypeName && field.descriptionField && field.descriptionFieldType && field.listQueryName && field.singleQueryName) {
      return (
        <ObjectFieldSelector
          label={fieldLabel}
          value={field.value as string | null | { id: string; [key: string]: unknown }}
          onChange={onChange}
          error={field.error}
          required={field.required}
          disabled={isViewMode || !enabled || isStateMachineField || isReadOnlyField}
          objectTypeName={field.objectTypeName}
          descriptionField={field.descriptionField}
          descriptionFieldType={field.descriptionFieldType}
          listQueryName={field.listQueryName}
          singleQueryName={field.singleQueryName}
        />
      );
    }
    
    if (field.isEnum && field.enumValues) {
      return (
        <>
          <FormControl fullWidth error={!!field.error}>
            <InputLabel>{fieldLabel}</InputLabel>
            <Select value={field.value as string} onChange={(e) => onChange(e.target.value)} label={fieldLabel} required={field.required} disabled={isViewMode || !enabled || isStateMachineField || isReadOnlyField}>
              {field.enumValues.map((enumValue) => (<MenuItem key={enumValue} value={enumValue}>{enumValue}</MenuItem>))}
            </Select>
          </FormControl>
          {field.error && <FormHelperText error>{field.error}</FormHelperText>}
        </>
      );
    }
    
    if (field.isList) {
      return (
        <Autocomplete multiple freeSolo options={[]} value={field.value as string[]}
          onChange={(_, newValue) => onChange(newValue)}
          disabled={isViewMode || !enabled || isStateMachineField || isReadOnlyField}
          slotProps={{ chip: { variant: "outlined" } }}
          renderInput={(params) => (
            <TextField {...params} label={fieldLabel} error={!!field.error} helperText={field.error} required={field.required} />
          )}
        />
      );
    }
    
    if (field.isBoolean) {
      return (
        <>
          <FormControlLabel
            control={<input type="checkbox" checked={field.value as boolean} onChange={(e) => onChange(e.target.checked)} disabled={isViewMode || !enabled || isStateMachineField || isReadOnlyField} />}
            label={fieldLabel}
          />
          {field.error && <FormHelperText error>{field.error}</FormHelperText>}
        </>
      );
    }

    if (field.isDate) {
      const formatDateForInput = (dateValue: FormField["value"]): string => {
        if (!dateValue || typeof dateValue !== 'string') return '';
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return '';
          return date.toISOString().split('T')[0];
        } catch { return ''; }
      };
      return (
        <TextField fullWidth label={fieldLabel} type="date"
          value={formatDateForInput(field.value)}
          onChange={(e) => onChange(e.target.value as string)}
          error={!!field.error} helperText={field.error} required={field.required}
          disabled={isViewMode || !enabled || isStateMachineField || isReadOnlyField}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      );
    }

    return (
      <TextField fullWidth label={fieldLabel} type={field.isNumeric ? "number" : "text"}
        value={field.value as string}
        onChange={(e) => onChange(e.target.value as string)}
        error={!!field.error} helperText={field.error} required={field.required}
        disabled={isViewMode || !enabled || isStateMachineField || isReadOnlyField}
      />
    );
  };

  if (entityLoading || (action !== "create" && !entityData && entityId)) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (formFields.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <Typography variant="h6" color="error">
          No form fields available for {listField}. Please check the schema configuration.
        </Typography>
      </Box>
    );
  }

  if (!queriesReady) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <Typography variant="h6" color="error">
          GraphQL queries not available. Please check the schema configuration.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component="button" variant="body2" onClick={() => navigate(backPath)} color="inherit" sx={{ cursor: "pointer", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
          {resolveLabel([getEntityName(listField, 'plural')], { entity: listField }, getEntityName(listField, 'plural'))}
        </Link>
        <Typography color="text.primary">
          {action === "create" 
            ? resolveLabel(["form.create"], { entity: listField }, "Create")
            : action === "edit" 
            ? resolveLabel(["form.edit"], { entity: listField }, "Edit")
            : resolveLabel(["form.view"], { entity: listField }, "View")
          }
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {action === "create" 
            ? resolveLabel(["form.create"], { entity: listField }, "Create")
            : action === "edit" 
            ? resolveLabel(["form.edit"], { entity: listField }, "Edit")
            : resolveLabel(["form.view"], { entity: listField }, "View")
          } {resolveLabel([getEntityName(listField, 'single')], { entity: listField }, getEntityName(listField, 'single'))}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={() => navigate(backPath)}>
            {resolveLabel(["form.cancel"], { entity: listField }, "Cancel")}
          </Button>
          
          {action === "edit" && entityTypeName && hasStateMachineSupport(entityTypeName) && entityData && (
            (() => {
              const currentState = (entityData as Record<string, unknown>).state;
              const availableActions = getAvailableStateMachineActions(entityTypeName, currentState as string);
              if (availableActions.length > 0) {
                return (
                  <Button variant="outlined" onClick={handleStateMachineMenuOpen} disabled={stateMachineLoading !== null}
                    startIcon={stateMachineLoading ? <CircularProgress size={16} /> : undefined}>
                    {resolveLabel(["stateMachine.actions"], { entity: listField }, "Actions")}
                  </Button>
                );
              }
              return null;
            })()
          )}
          
          {action !== "view" && customizationState.customization.mode !== 'stepper' && (
            <Button type="submit" variant="contained" disabled={loading} form="entity-form">
              {loading ? <CircularProgress size={20} /> : action === "create" 
                ? resolveLabel(["form.create"], { entity: listField }, "Create")
                : resolveLabel(["form.update"], { entity: listField }, "Update")
              }
            </Button>
          )}
        </Box>
      </Box>

      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {formMessage && <Alert severity={formMessage.type} sx={{ mb: 2 }}>{typeof formMessage.message === 'string' ? formMessage.message : formMessage.message}</Alert>}

      {(() => {
        const isStepperMode = customizationState.customization.mode === 'stepper';
        const steps = customizationState.customization.steps || [];
        
        const handleStepClick = (stepIndex: number) => { setCurrentStepIndex(stepIndex); };
        
        const handleNextStep = async () => {
          if (currentStepIndex < steps.length - 1) {
            const currentStep = steps[currentStepIndex];
            if (currentStep?.onNext) {
              try {
                const collectionChanges = getCollectionChanges();
                const transformedData = buildTransformedInput(formData, collectionChanges);
                const shouldContinue = await currentStep.onNext(formData, collectionChanges as Record<string, FormCustomizationCollectionFieldState>, transformedData, formActions);
                if (shouldContinue === false) return;
              } catch { return; }
            }
            setCurrentStepIndex(currentStepIndex + 1);
          }
        };
        
        const handlePreviousStep = async () => {
          if (currentStepIndex > 0) {
            const currentStep = steps[currentStepIndex];
            if (currentStep?.onBack) {
              try {
                const collectionChanges = getCollectionChanges();
                const transformedData = buildTransformedInput(formData, collectionChanges);
                const shouldContinue = await currentStep.onBack(formData, collectionChanges as Record<string, FormCustomizationCollectionFieldState>, transformedData, formActions);
                if (shouldContinue === false) return;
              } catch { return; }
            }
            setCurrentStepIndex(currentStepIndex - 1);
          }
        };
        
        const isCurrentStepValid = () => {
          if (!isStepperMode || steps.length === 0) return true;
          const currentStep = steps[currentStepIndex];
          const currentStepId = currentStep?.stepId;
          const stepFields = formFields.filter(field => {
            const fc = customizationState.customization[field.name];
            if (typeof fc === 'object' && fc !== null && 'stepId' in fc) return (fc as { stepId?: string }).stepId === currentStepId;
            return false;
          });
          for (const field of stepFields) {
            const isVisible = isFieldVisible(field.name, customizationState, field.value, formData);
            const isEnabled = isFieldEnabled(field.name, customizationState, field.value, formData);
            if (!isVisible || !isEnabled) continue;
            if (field.required) {
              const fieldData = formData[field.name];
              const fieldValue = fieldData?.value;
              if (field.isEmbedded && field.embeddedFields) {
                for (const ef of field.embeddedFields) {
                  if (ef.required) {
                    const efd = formData[ef.name];
                    if (efd?.value === undefined || efd?.value === null || efd?.value === '') return false;
                  }
                }
              } else {
                if (fieldValue === undefined || fieldValue === null || fieldValue === '') return false;
              }
            }
          }
          return true;
        };
        
        if (isStepperMode && steps.length > 0) {
          const currentStep = steps[currentStepIndex];
          const currentStepId = currentStep?.stepId;
          const stepperSteps = steps.map((step, index) => ({
            id: index + 1,
            label: resolveLabel([step.stepLabel], { entity: listField }, step.stepLabel),
          }));
          
          return (
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <StepsPanel activeStep={currentStepIndex} steps={stepperSteps} handleStepClick={handleStepClick}
                variant={action === "create" ? variants.classic : variants.linear} allowClickBack={true} />
              
              <Paper sx={{ p: 3, flex: 1 }}>
                <form id="entity-form" onSubmit={handleSubmit}>
                  {currentStep?.customStepRenderer ? (
                    currentStep.customStepRenderer(formActions, handleFieldChange, handleEmbeddedFieldChange, action === "view", formData)
                  ) : (
                    <>
                      <Grid container spacing={3}>
                        {(() => {
                          const mainFormFields = formFields.filter(field => !field.isCollection);
                          const orderedFields = getFieldOrder(customizationState);
                          const visibleFields = mainFormFields.filter(field => isFieldVisible(field.name, customizationState, field.value, formData));
                          const stepFields = visibleFields.filter(field => {
                            const fc = customizationState.customization[field.name];
                            if (typeof fc === 'object' && fc !== null && 'stepId' in fc) return (fc as { stepId?: string }).stepId === currentStepId;
                            return false;
                          });
                          const sortedFields = stepFields.sort((a, b) => {
                            const ai = orderedFields.indexOf(a.name);
                            const bi = orderedFields.indexOf(b.name);
                            if (ai === -1 && bi === -1) return 0;
                            if (ai === -1) return 1;
                            if (bi === -1) return -1;
                            return ai - bi;
                          });
                          return sortedFields.map(field => {
                            if (field.isEmbedded) return null;
                            const fieldSize = getFieldSize(field.name, customizationState.customization);
                            const isEnabled = isFieldEnabled(field.name, customizationState, field.value, formData);
                            return (
                              <Grid key={field.name} size={fieldSize}>
                                {renderField(formData[field.name] || field, isEnabled)}
                              </Grid>
                            );
                          });
                        })()}
                      </Grid>

                      {(() => {
                        const embeddedFields = formFields.filter(field => {
                          if (!field.isEmbedded) return false;
                          const fc = customizationState.customization[field.name];
                          if (typeof fc === 'object' && fc !== null && 'stepId' in fc) return (fc as { stepId?: string }).stepId === currentStepId;
                          return false;
                        });
                        if (embeddedFields.length === 0) return null;
                        const sortedEF = embeddedFields.sort((a, b) => {
                          const ac = getEmbeddedSectionCustomization(customizationState.customization, a.name);
                          const bc = getEmbeddedSectionCustomization(customizationState.customization, b.name);
                          return (ac?.order ?? 999) - (bc?.order ?? 999);
                        });
                        return <>{sortedEF.map(field => renderEmbeddedSection(field, true))}</>;
                      })()}

                      {(() => {
                        const collectionFields = formFields.filter(field => {
                          if (!field.isCollection || !field.collectionObjectTypeName || !field.connectionField) return false;
                          if (field.isEmbedded) return false;
                          const fc = customizationState.customization[field.name];
                          if (typeof fc === 'object' && fc !== null && 'stepId' in fc) return (fc as { stepId?: string }).stepId === currentStepId;
                          return false;
                        });
                        if (collectionFields.length === 0) return null;
                        return (
                          <>
                            {collectionFields.map(field => {
                              const cc = getCollectionFieldCustomization(customizationState.customization, field.name);
                              if (cc?.customCollectionRenderer) {
                                return (
                                  <Box key={field.name} sx={{ mt: 3 }}>
                                    {cc.customCollectionRenderer(field.name, parentFormAccess, getCollectionState(field.name) as unknown as Record<string, unknown>, (ns: Record<string, unknown>) => updateCollectionState(field.name, ns as unknown as CollectionFieldState), entityId || null, action === "edit")}
                                  </Box>
                                );
                              }
                              return (
                                <Box key={field.name} sx={{ mt: 3 }}>
                                  <CollectionFieldGrid
                                    collectionField={{ name: field.name, objectTypeName: field.collectionObjectTypeName!, connectionField: field.connectionField! }}
                                    parentEntityId={entityId || ""} parentEntityType={entityTypeName || ""}
                                    isEditMode={action === "edit"} collectionState={getCollectionState(field.name)}
                                    onCollectionStateChange={updateCollectionState} parentFormAccess={parentFormAccess}
                                  />
                                </Box>
                              );
                            })}
                          </>
                        );
                      })()}
                    </>
                  )}
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                    <Button type="button" onClick={(e) => { e.preventDefault(); handlePreviousStep(); }} disabled={currentStepIndex === 0} variant="outlined">
                      {resolveLabel(["form.back"], { entity: listField }, "Back")}
                    </Button>
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {currentStep?.actions?.map((stepAction) => (
                        <React.Fragment key={stepAction.name}>
                          {stepAction.renderer(formActions, formData, getCollectionChanges(), action)}
                        </React.Fragment>
                      ))}
                      
                      {currentStepIndex === steps.length - 1 && action !== "view" ? (
                        <Button type="submit" variant="contained" disabled={loading}>
                          {loading ? <CircularProgress size={20} /> : action === "create" 
                            ? resolveLabel(["form.create"], { entity: listField }, "Create")
                            : resolveLabel(["form.update"], { entity: listField }, "Update")
                          }
                        </Button>
                      ) : (
                        <Button type="button" onClick={(e) => { e.preventDefault(); handleNextStep(); }} disabled={currentStepIndex === steps.length - 1 || !isCurrentStepValid()} variant="contained">
                          {resolveLabel(["form.next"], { entity: listField }, "Next")}
                        </Button>
                      )}
                    </Box>
                  </Box>
                </form>
              </Paper>
            </Box>
          );
        }
        
        return (
          <Paper sx={{ p: 3 }}>
            <form id="entity-form" onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                {(() => {
                  const mainFormFields = formFields.filter(field => !field.isCollection);
                  const orderedFields = getFieldOrder(customizationState);
                  const visibleFields = mainFormFields.filter(field => isFieldVisible(field.name, customizationState, field.value, formData));
                  const sortedFields = visibleFields.sort((a, b) => {
                    const ai = orderedFields.indexOf(a.name);
                    const bi = orderedFields.indexOf(b.name);
                    if (ai === -1 && bi === -1) return 0;
                    if (ai === -1) return 1;
                    if (bi === -1) return -1;
                    return ai - bi;
                  });
                  return sortedFields.map(field => {
                    if (field.isEmbedded) return null;
                    const fieldSize = getFieldSize(field.name, customizationState.customization);
                    const isEnabled = isFieldEnabled(field.name, customizationState, field.value, formData);
                    return (
                      <Grid key={field.name} size={fieldSize}>
                        {renderField(formData[field.name] || field, isEnabled)}
                      </Grid>
                    );
                  });
                })()}
              </Grid>

              {(() => {
                const embeddedFields = formFields.filter(field => field.isEmbedded);
                if (embeddedFields.length === 0) return null;
                const sortedEF = embeddedFields.sort((a, b) => {
                  const ac = getEmbeddedSectionCustomization(customizationState.customization, a.name);
                  const bc = getEmbeddedSectionCustomization(customizationState.customization, b.name);
                  return (ac?.order ?? 999) - (bc?.order ?? 999);
                });
                return <>{sortedEF.map(field => renderEmbeddedSection(field, true))}</>;
              })()}
            </form>
          </Paper>
        );
      })()}

      {(() => {
        const isStepperMode = customizationState.customization.mode === 'stepper';
        if (isStepperMode) return null;
        const validCollectionFields = formFields.filter(field => field.isCollection && !field.isEmbedded && field.collectionObjectTypeName && field.connectionField);
        return validCollectionFields.map(field => {
          const cc = getCollectionFieldCustomization(customizationState.customization, field.name);
          if (cc?.customCollectionRenderer) {
            return (
              <Box key={field.name} sx={{ mt: 3 }}>
                {cc.customCollectionRenderer(field.name, parentFormAccess, getCollectionState(field.name) as unknown as Record<string, unknown>, (ns: Record<string, unknown>) => updateCollectionState(field.name, ns as unknown as CollectionFieldState), entityId || null, action === "edit")}
              </Box>
            );
          }
          return (
            <Box key={field.name} sx={{ mt: 3 }}>
              <CollectionFieldGrid
                collectionField={{ name: field.name, objectTypeName: field.collectionObjectTypeName!, connectionField: field.connectionField! }}
                parentEntityId={entityId || ""} parentEntityType={entityTypeName || ""}
                isEditMode={action === "edit"} collectionState={getCollectionState(field.name)}
                onCollectionStateChange={updateCollectionState} parentFormAccess={parentFormAccess}
              />
            </Box>
          );
        });
      })()}

      {entityTypeName && hasStateMachineSupport(entityTypeName) && entityData && (
        <Menu anchorEl={stateMachineMenuAnchor} open={Boolean(stateMachineMenuAnchor)} onClose={handleStateMachineMenuClose}>
          {(() => {
            const currentState = (entityData as Record<string, unknown>).state;
            const availableActions = getAvailableStateMachineActions(entityTypeName, currentState as string);
            return availableActions.map(({ name }) => (
              <MenuItem key={name} onClick={() => handleStateMachineAction(name)} disabled={stateMachineLoading === name}>
                {stateMachineLoading === name ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                {resolveStateMachineActionLabel(resolveLabel, entityTypeName, name, name)}
              </MenuItem>
            ));
          })()}
        </Menu>
      )}

      <Snackbar open={!!successMessage} autoHideDuration={6000} onClose={() => setSuccessMessage(null)}>
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>
      </Snackbar>
    </Box>
  );
}

function getDefaultValue(typeName: string | null, isBoolean: boolean, isList: boolean, isObject: boolean): string | number | boolean | string[] | null {
  if (isObject) return null;
  if (isList) return [];
  if (isBoolean) return false;
  if (typeName === "Int" || typeName === "Float") return 0;
  return "";
}
