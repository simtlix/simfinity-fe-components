import * as React from "react";
import { useQuery, useMutation, gql, useApolloClient } from "@apollo/client";
import { getEntityFormCallbacks, EntityFormCallbackActions, FormMessage, CollectionFieldState as FormCustomizationCollectionFieldState, ParentFormAccess, FormStep } from "./lib/formCustomization";
import { getEntityStateMachine, getAvailableStateMachineActions, hasStateMachineSupport } from "./lib/stateMachineRegistry";
import { resolveStateMachineActionLabel } from "./lib/i18n";
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Divider,
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
import CustomStepper, { variants } from "./Stepper";

// GraphQL queries and mutations
const GET_ENTITY_QUERY = gql`
  query GetEntity($id: ID!) {
    entity(id: $id) {
      id
      # Dynamic fields will be added based on schema
    }
  }
`;

const CREATE_ENTITY_MUTATION = gql`
  mutation CreateEntity($input: CreateEntityInput!) {
    createEntity(input: $input) {
      id
      # Dynamic fields will be added based on schema
    }
  }
`;

const UPDATE_ENTITY_MUTATION = gql`
  mutation UpdateEntity($id: ID!, $input: UpdateEntityInput!) {
    updateEntity(id: $id, input: $input) {
      id
      # Dynamic fields will be added based on schema
    }
  }
`;

import { INTROSPECTION_QUERY, SchemaData, getElementTypeNameOfListField, getTypeByName, isNumericScalarName, isBooleanScalarName, isDateTimeScalarName, isScalarOrEnum, unwrapNamedType, getListEntityFieldNamesOfType } from "./lib/introspection";
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
  getFieldSize,
  isFieldVisible,
  isFieldEnabled,
  getFieldOrder,
  getEmbeddedFieldCustomization,
  getEmbeddedSectionCustomization,
  getEmbeddedFieldSize,
  getCollectionFieldCustomization
} from "./lib/formCustomization";

type EntityFormProps = {
  listField: string; // e.g., "series"
  entityId?: string; // undefined for create, string for edit/view
  action: "create" | "edit" | "view"; // action from URL
  // Optional navigation handling
  onNavigate?: (path: string) => void;
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
  descriptionFieldType?: string; // The type of the description field
  listQueryName?: string;
  singleQueryName?: string;
  isEmbedded?: boolean; // Whether this field is an embedded object
  embeddedFields?: FormField[]; // Fields within the embedded object
  isCollection?: boolean; // Whether this field is a collection of objects
  collectionObjectTypeName?: string; // The type name of objects in the collection
  connectionField?: string; // The field name used to connect to the parent entity
  isStateMachine?: boolean; // Whether this field is managed by state machine mutations
};

type FormData = Record<string, FormField>;



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

// Helper function to get query names for an object type
function getQueryNamesForObjectType(schema: SchemaData, objectTypeName: string): { listQueryName: string; singleQueryName: string } | null {
  try {
    // Get the list query names for this object type
    const listQueryNames = getListEntityFieldNamesOfType(schema, objectTypeName);
    
    if (listQueryNames.length === 0) {
      console.warn(`No list query found for object type: ${objectTypeName}`);
      return null;
    }
    
    // Use the first list query name (usually the plural form)
    const listQueryName = listQueryNames[0];
    
    // For single query, use the object type name
    const singleQueryName = objectTypeName;
    
    return { listQueryName, singleQueryName };
  } catch (error) {
    console.error(`Error getting query names for object type ${objectTypeName}:`, error);
    return null;
  }
}



// Helper function to get the type of a field in an object type
function getDescriptionFieldType(schema: SchemaData, objectTypeName: string, descriptionField: string): string {
  try {
    const objectType = getTypeByName(schema, objectTypeName);
    if (!objectType?.fields) return "String";
    
    const field = objectType.fields.find(f => f.name === descriptionField);
    if (!field) return "String";
    
    // Unwrap the type to handle NON_NULL and LIST wrappers
    const typeName = unwrapNamedType(field.type);
    return typeName || "String";
  } catch (error) {
    console.error(`Error getting description field type for ${objectTypeName}.${descriptionField}:`, error);
    return "String";
  }
}

// Helper function to process embedded object fields
function processEmbeddedObjectFields(schema: SchemaData, objectTypeName: string, parentFieldName: string): FormField[] {
  try {
    const objectType = getTypeByName(schema, objectTypeName);
    if (!objectType?.fields) return [];
    
    return objectType.fields
      .filter(field => field.name !== "id") // Exclude id fields from embedded objects since they don't have IDs
      .map(field => {
        try {
          const typeName = unwrapNamedType(field.type);
          const isNumeric = isNumericScalarName(typeName);
          const isBoolean = isBooleanScalarName(typeName);
          const isDate = isDateTimeScalarName(typeName);
          const isRequired = isNonNullField(field.type);
          const isList = field.type.kind === "LIST";
          
          // Check if this is an ENUM type
          let current = field.type as { kind?: string; ofType?: unknown; name?: string };
          while (current && current.kind && (current.kind === "NON_NULL" || current.kind === "LIST")) {
            current = current.ofType as { kind?: string; ofType?: unknown; name?: string };
          }
          const isEnum = current?.kind === "ENUM";
          const enumValues = isEnum && typeName ? getEnumValues(schema, typeName) : undefined;
          
          return {
            name: `${parentFieldName}.${field.name}`,
            type: typeName || "String",
            isNumeric,
            isBoolean,
            isDate,
            isList,
            isEnum,
            enumValues,
            isObject: false, // Embedded fields are not objects themselves
            required: isRequired,
            value: getDefaultValue(typeName, isBoolean, isList, false),
            error: undefined,
          };
        } catch (error) {
          console.error(`Error processing embedded field ${field.name}:`, error);
          return null;
        }
      })
      .filter((field): field is NonNullable<typeof field> => field !== null);
  } catch (error) {
    console.error(`Error processing embedded object fields for ${objectTypeName}:`, error);
    return [];
  }
}

export default function EntityForm({ listField, entityId, action, onNavigate }: EntityFormProps) { 
  // Navigation handling - use provided function or fallback to window.location
  const navigate = React.useCallback((path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  }, [onNavigate]);
  const { resolveLabel } = useI18n();
  const client = useApolloClient();
  const [formData, setFormData] = React.useState<FormData>({} as FormData);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [formMessage, setFormMessage] = React.useState<FormMessage | null>(null);
  
  // Stepper mode state
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  
  // State machine functionality
  const [stateMachineMenuAnchor, setStateMachineMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [stateMachineLoading, setStateMachineLoading] = React.useState<string | null>(null);

  // Form customization state
  const [customizationState, setCustomizationState] = React.useState<FormCustomizationState>({
    customization: {},
    fieldVisibility: {},
    fieldEnabled: {},
    fieldOrder: [],
  });

  // Get schema data to understand entity structure
  const { data: schemaData, loading: schemaLoading, error: schemaError } = useQuery(INTROSPECTION_QUERY);
  


  // Get entity type name for use throughout the component (memoized)
  const entityTypeName = React.useMemo(() => {
    if (!schemaData) return null;
    return getElementTypeNameOfListField(schemaData as SchemaData, listField);
  }, [schemaData, listField]);

  // Collection state management
  const { 
    updateCollectionState, 
    getCollectionState,
    getCollectionChanges,
    resetAllCollectionStates
  } = useCollectionState();

  // Create reusable callback actions
  const createCallbackActions = React.useCallback((): EntityFormCallbackActions => ({
    setFieldData: (fieldName: string, value: unknown) => {
      setFormData(prev => ({
        ...prev,
        [fieldName]: { ...prev[fieldName], value: value as string | number | boolean | string[] | null | { id: string; [key: string]: unknown } }
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
    setCollectionChanges: (fieldName: string, changes: FormCustomizationCollectionFieldState) => {
      const componentChanges: CollectionFieldState = {
        added: changes.added as CollectionItem[],
        modified: changes.modified as CollectionItem[],
        deleted: changes.deleted as CollectionItem[]
      };
      updateCollectionState(fieldName, componentChanges);
    },
    setFormMessage: (message: FormMessage) => {
      setFormMessage(message);
    },
    setError: (errorMessage: string) => {
      setError(errorMessage);
    }
  }), [ updateCollectionState, setCustomizationState, setFormData, setFormMessage, setError]);

  // Helper function to get entity name from i18n
  const getEntityName = React.useCallback((pluralName: string, form: 'single' | 'plural'): string => {
    if (!schemaData) return `entity.${pluralName}.${form}`;
    
    // Get the proper entity type name from schema
    const entityTypeNameForI18n = getElementTypeNameOfListField(schemaData as SchemaData, pluralName);
    if (!entityTypeNameForI18n) return `entity.${pluralName}.${form}`;
    
    // Convert to lowercase for i18n key
    const baseName = entityTypeNameForI18n.toLowerCase();
    
    return `entity.${baseName}.${form}`;
  }, [schemaData]);

  // Form customization actions
  const customizationActions: FormCustomizationActions = React.useMemo(() => ({
    setFieldData: (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => {
      // Check if this is an embedded field (contains a dot)
      if (fieldName.includes('.')) {
        const [parentField, embeddedField] = fieldName.split('.');
        const fullFieldName = `${parentField}.${embeddedField}`;
        
        setFormData(prev => ({
          ...prev,
          [fullFieldName]: { 
            ...prev[fullFieldName], 
            value: value === null ? "" : value 
          }
        }));
      } else {
        // Regular field
        setFormData(prev => ({
          ...prev,
          [fieldName]: { ...prev[fieldName], value }
        }));
      }
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

  // Parent form access for collection items
  const parentFormAccess: ParentFormAccess = React.useMemo(() => ({
    parentFormData: formData,
    parentFieldVisibility: customizationState.fieldVisibility,
    parentFieldEnabled: customizationState.fieldEnabled,
    setParentFieldData: customizationActions.setFieldData,
    setParentFieldVisible: customizationActions.setFieldVisible,
    setParentFieldEnabled: customizationActions.setFieldEnabled,
  }), [formData, customizationState.fieldVisibility, customizationState.fieldEnabled, customizationActions]);

  // Build form fields based on schema first
  const formFields = React.useMemo(() => {
    if (!schemaData) {
      console.log('No schema data available');
      return [];
    }
    
    try {
      const schema = schemaData as SchemaData;
      console.log('Schema data:', schema);
      
      const entityTypeName = getElementTypeNameOfListField(schema, listField);
      if (!entityTypeName) {
        console.log('No entity type name:', entityTypeName);
        return [];
      }
      
      console.log('Entity type name:', entityTypeName);
      
      const entityType = getTypeByName(schema, entityTypeName);
      if (!entityType?.fields) {
        console.log('No entity type or fields found:', entityType);
        return [];
      }
      

      
      const filteredFields = entityType.fields
        .filter(field => {
          try {
            const isNotId = field.name !== "id";
            if (!isNotId) return false;
            
            // Exclude state machine fields from create forms (but include in edit for display)
            const isStateMachineField = field.extensions?.stateMachine === true;
            if (isStateMachineField && action === "create") {
              console.log(`Field ${field.name}: EXCLUDED - State machine field (create mode)`);
              return false;
            }
            if (isStateMachineField && action !== "create") {
              console.log(`Field ${field.name}: INCLUDED - State machine field (edit/view mode for display)`);
              return true;
            }
            
            // Check if this is a list type
            let current = field.type as { kind?: string; ofType?: unknown; name?: string };
            const isList = current?.kind === "LIST";
            
            if (isList) {
              // For list fields, check if the underlying type is a scalar or object
              while (current && current.kind && (current.kind === "NON_NULL" || current.kind === "LIST")) {
                current = current.ofType as { kind?: string; ofType?: unknown; name?: string };
              }
              const underlyingIsScalar = current?.kind && isScalarOrEnum(current.kind);
              const underlyingIsObject = current?.kind === "OBJECT";
              
              // Include list-of-scalar fields for tag input
              if (underlyingIsScalar) {
                console.log(`Field ${field.name}: INCLUDED - List of scalar (${current?.name}) for tag input`);
                return true;
              }
              
              // Include list-of-object fields for collection grid rendering
              if (underlyingIsObject) {
                console.log(`Field ${field.name}: INCLUDED - List of object (${current?.name}) for collection grid`);
                return true;
              }
            } else {
              // For non-list fields, check if the underlying type is a scalar or object
              current = field.type as { kind?: string; ofType?: unknown; name?: string };
              while (current && current.kind && (current.kind === "NON_NULL" || current.kind === "LIST")) {
                current = current.ofType as { kind?: string; ofType?: unknown; name?: string };
              }
              const isScalar = current?.kind && isScalarOrEnum(current.kind);
              const isObject = current?.kind === "OBJECT";
              
              // Include embedded object fields for section rendering
              const isEmbedded = field.extensions?.relation?.embedded === true;
              const shouldIncludeObject = isObject && !isEmbedded;
              const shouldIncludeEmbedded = isObject && isEmbedded;
              
              console.log(`Field ${field.name}: underlying kind=${current?.kind}, isScalar=${isScalar}, isObject=${isObject}, isEmbedded=${isEmbedded}, shouldIncludeObject=${shouldIncludeObject}, shouldIncludeEmbedded=${shouldIncludeEmbedded}, isNotId=${isNotId}, type.kind=${field.type.kind}`);
              return isScalar || shouldIncludeObject || shouldIncludeEmbedded;
            }
            
            return false;
          } catch (error) {
            console.error(`Error filtering field ${field.name}:`, error);
            return false;
          }
        });
      
      console.log('Filtered fields:', filteredFields);
      
      const processedFields = filteredFields.map(field => {
        try {
          const typeName = unwrapNamedType(field.type);
          const isNumeric = isNumericScalarName(typeName);
          const isBoolean = isBooleanScalarName(typeName);
          const isDate = isDateTimeScalarName(typeName);
          const isRequired = isNonNullField(field.type);
          const isList = field.type.kind === "LIST";
          
          // Check if this is an ENUM type
          let current = field.type as { kind?: string; ofType?: unknown; name?: string };
          while (current && current.kind && (current.kind === "NON_NULL" || current.kind === "LIST")) {
            current = current.ofType as { kind?: string; ofType?: unknown; name?: string };
          }
          const isEnum = current?.kind === "ENUM";
          const enumValues = isEnum && typeName ? getEnumValues(schema, typeName) : undefined;
          
          // Check if this is an OBJECT type (non-list)
          const isObject = current?.kind === "OBJECT" && !isList;
          const objectTypeName = isObject && typeName && typeName !== null ? typeName : undefined;
          const descriptionField = isObject && field.extensions?.relation?.displayField ? 
            field.extensions.relation.displayField : "name";
          
          // Check if this is a COLLECTION type (list of objects)
          const isCollection = isList && current?.kind === "OBJECT";
          const collectionObjectTypeName = isCollection && typeName && typeName !== null ? typeName : undefined;
          let connectionField = isCollection && field.extensions?.relation?.connectionField ? 
            field.extensions.relation.connectionField : undefined;
          
          // Fallback: try to derive connectionField if not explicitly defined
          if (isCollection && !connectionField && collectionObjectTypeName) {
            // Use the proper entity type name from introspection
            const entityTypeName = getElementTypeNameOfListField(schema, listField);
            if (entityTypeName) {
              // Convert to lowercase for connection field (e.g., 'Serie' -> 'serie')
              connectionField = entityTypeName.toLowerCase();
              console.log(`Collection field ${field.name}: Using fallback connectionField: ${connectionField}`);
            }
          }
          
          // Debug collection field detection
          if (isCollection) {
            console.log(`Collection field ${field.name}:`, {
              typeName,
              extensions: field.extensions,
              connectionField,
              relation: field.extensions?.relation
            });
          }
          
          // Get description field type for object types
          const descriptionFieldType = isObject && objectTypeName && descriptionField ? 
            getDescriptionFieldType(schema, objectTypeName, descriptionField) : undefined;
          
          // Get query names for object types
          const queryNames = isObject && objectTypeName ? getQueryNamesForObjectType(schema, objectTypeName) : null;
          const listQueryName = queryNames?.listQueryName;
          const singleQueryName = queryNames?.singleQueryName;
          
          // Check if the object field is non-null (required)
          const isObjectRequired = isObject && isNonNullField(field.type);
          
          // Check if this is an embedded object field
          const isEmbedded = field.extensions?.relation?.embedded === true;
          const embeddedFields = isEmbedded && objectTypeName ? 
            processEmbeddedObjectFields(schema, objectTypeName, field.name) : undefined;
          
          console.log(`Field ${field.name}: type=${typeName}, isNumeric=${isNumeric}, isBoolean=${isBoolean}, isDate=${isDate}, isRequired=${isRequired}, isList=${isList}, isEnum=${isEnum}, isObject=${isObject}, isEmbedded=${isEmbedded}, isCollection=${isCollection}, objectTypeName=${objectTypeName}, descriptionField=${descriptionField}, collectionObjectTypeName=${collectionObjectTypeName}, connectionField=${connectionField}`);
          
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
            isStateMachine: field.extensions?.stateMachine === true || (listField === "seasons" && field.name === "state"),
            required: isObject ? isObjectRequired : isRequired,
            value: getDefaultValue(typeName || "String", isBoolean, isList, isObject),
            error: undefined,
          };
        } catch (error) {
          console.error(`Error processing field ${field.name}:`, error);
          return null;
        }
      });
      
      return processedFields.filter((field): field is NonNullable<typeof field> => field !== null);
    } catch (error) {
      console.error('Error building form fields:', error);
      return [];
    }
  }, [schemaData, listField, action]);

  // Initialize customization state when formFields change
  React.useEffect(() => {
    if (formFields.length > 0 && entityTypeName) {
      const fieldNames = formFields.map(field => field.name);
      const newCustomizationState = createFormCustomizationState(entityTypeName, action, fieldNames);
      setCustomizationState(newCustomizationState);
      console.log('Initialized customization state for', entityTypeName, ':', newCustomizationState);
    }
  }, [formFields, entityTypeName, action]);

  // For now, we'll skip the dynamic GraphQL queries and just show the form
  // The actual GraphQL integration can be added later once the form rendering works
  const queriesReady = true;

  // Helper function to get i18n label for form fields
  const getFieldLabel = (fieldName: string): string => {
    // Try to get the label using the entity.field pattern (e.g., "serie.name")
    const entityKey = entityTypeName ? entityTypeName.toLowerCase() : listField.slice(0, -1); // Fallback to old method if introspection fails
    const fieldKey = `${entityKey}.${fieldName}`;
    
    return resolveLabel([fieldKey, fieldName], { entity: listField, field: fieldName }, fieldName);
  };

  // Generate dynamic GraphQL queries based on schema
  const generateQueries = React.useMemo(() => {
    if (!formFields.length) return null;
    
    // Build field selections including object field details, but EXCLUDE collection fields
    const fieldSelections = formFields
      .filter(field => !field.isCollection) // Exclude collection fields from main query
      .map(field => {
        if (field.isObject && field.objectTypeName && field.descriptionField) {
          if (field.isEmbedded) {
            // For embedded objects, include all fields that are rendered in the form
            const embeddedFieldNames = field.embeddedFields?.map(ef => ef.name.replace(`${field.name}.`, '')) || [];
            console.log(`Embedded object ${field.name}: including fields:`, embeddedFieldNames);
            return `${field.name} {
              ${embeddedFieldNames.join('\n            ')}
            }`;
          } else {
            // For non-embedded objects, include id for proper object reference
            return `${field.name} {
              id
              ${field.descriptionField}
            }`;
          }
        }
        return field.name;
      });
    
    const fieldNames = fieldSelections.join('\n      ');
    if (!entityTypeName) {
      console.error('No entity type name found for generating queries');
      return null;
    }
    const entityName = entityTypeName; // Use introspection result
    
    console.log('Generating queries for:', { 
      entityName, 
      entityTypeName,
      fieldNames, 
      includedFields: formFields.filter(f => !f.isCollection).map(f => ({ name: f.name, isObject: f.isObject, objectTypeName: f.objectTypeName })),
      excludedCollectionFields: formFields.filter(f => f.isCollection).map(f => ({ name: f.name, collectionObjectTypeName: f.collectionObjectTypeName, connectionField: f.connectionField }))
    });
    
    const getQuery = gql`
      query Get${entityName.charAt(0).toUpperCase() + entityName.slice(1)}($id: ID!) {
        ${entityName}(id: $id) {
          id
          ${fieldNames}
        }
      }
    `;
    
    const createMutation = gql`
      mutation Add${entityName.charAt(0).toUpperCase() + entityName.slice(1)}($input: ${entityName}Input!) {
        add${entityName}(input: $input) {
          id
          ${fieldNames}
        }
      }
    `;
    
    const updateMutation = gql`
      mutation Update${entityName.charAt(0).toUpperCase() + entityName.slice(1)}($input: ${entityName}InputForUpdate!) {
        update${entityName}(input: $input) {
          id
          ${fieldNames}
        }
      }
    `;
    
    console.log('Generated getQuery:', getQuery.loc?.source.body);
    
    return { getQuery, createMutation, updateMutation };
  }, [entityTypeName, formFields]);

  // Fetch entity data for edit/view mode
  const { data: entityData, loading: entityLoading, error: entityError } = useQuery(
    generateQueries?.getQuery || GET_ENTITY_QUERY,
    {
      variables: { id: entityId },
      skip: !entityId || !generateQueries?.getQuery || action === "create",
    }
  );

  console.log('Query execution:', {
    entityId,
    action,
    skip: !entityId || !generateQueries?.getQuery || action === "create",
    entityData,
    entityLoading,
    entityError,
    hasQuery: !!generateQueries?.getQuery
  });

  // Mutations for create and update
  const [addEntity, { loading: createLoading }] = useMutation(
    generateQueries?.createMutation || CREATE_ENTITY_MUTATION
  );
  
  const [updateEntity, { loading: updateLoading }] = useMutation(
    generateQueries?.updateMutation || UPDATE_ENTITY_MUTATION
  );

  // Initialize form data
  React.useEffect(() => {
    if (formFields.length > 0) {
      // Only initialize if we don't have any form data yet or if we're in create mode
      setFormData(prevData => {
        if (Object.keys(prevData).length === 0 || action === "create") {
          const initialData: FormData = {};
          formFields.forEach(field => {
            initialData[field.name] = field;
          });
          console.log('Initializing form data with:', initialData);
          return initialData;
        }
        return prevData;
      });
    }
  }, [formFields, action]);

  // Load existing entity data for edit/view
  React.useEffect(() => {
    console.log('Data loading effect triggered:', { entityData, action, listField, formFields });
    
    if (entityData && action !== "create" && formFields.length > 0 && entityTypeName) {
      const entityName = entityTypeName; // Use introspection result
      console.log('Looking for entity with name:', entityName);
      console.log('Available keys in entityData:', Object.keys(entityData));
      
      const entity = entityData[entityName];
      console.log('Found entity:', entity);
      
      if (entity) {
        console.log('Entity fields:', Object.keys(entity));
        console.log('Form fields:', formFields.map(f => f.name));
        
        const updatedData: FormData = {};
        formFields.forEach(field => {
          console.log(`Checking field ${field.name}:`, entity[field.name]);
          if (entity[field.name] !== undefined) {
            let fieldValue = entity[field.name];
            
            // Handle object fields - extract the ID for non-embedded objects
            if (field.isObject && !field.isEmbedded && fieldValue && typeof fieldValue === 'object' && 'id' in fieldValue) {
              fieldValue = fieldValue.id;
            }
            
            updatedData[field.name] = {
              ...field,
              value: fieldValue,
            };
            console.log(`Updated field ${field.name} with value:`, fieldValue);
            
            // Handle embedded object fields - populate their nested fields
            if (field.isEmbedded && field.embeddedFields && fieldValue && typeof fieldValue === 'object') {
              console.log(`Processing embedded object ${field.name}:`, fieldValue);
              field.embeddedFields.forEach(embeddedField => {
                const embeddedFieldName = embeddedField.name.replace(`${field.name}.`, '');
                const embeddedFieldValue = fieldValue[embeddedFieldName];
                
                console.log(`Embedded field ${embeddedField.name}: extracted name = ${embeddedFieldName}, value = ${embeddedFieldValue}`);
                
                if (embeddedFieldValue !== undefined) {
                  updatedData[embeddedField.name] = {
                    ...embeddedField,
                    value: embeddedFieldValue,
                  };
                  console.log(`Updated embedded field ${embeddedField.name} with value:`, embeddedFieldValue);
                } else {
                  updatedData[embeddedField.name] = embeddedField;
                  console.log(`Embedded field ${embeddedField.name} not found in data, using default`);
                }
              });
            }
          } else {
            updatedData[field.name] = field;
          }
        });
        console.log('Final updated data:', updatedData);
        setFormData(updatedData);
      }
    }
  }, [entityData, entityTypeName, action, formFields, listField]);

  // Handle field changes
  const handleFieldChange = (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }, error?: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        value: value === null ? "" : value,
        error: error,
      },
    }));
  };

  // Handle embedded field changes
  const handleEmbeddedFieldChange = (parentFieldName: string, embeddedFieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }, error?: string) => {
    const fullFieldName = `${parentFieldName}.${embeddedFieldName}`;
    setFormData(prev => ({
      ...prev,
      [fullFieldName]: {
        ...prev[fullFieldName],
        value: value === null ? "" : value,
        error: error,
      },
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    let isValid = true;
    const newFormData = { ...formData };

    // Recursive field validation function
    const validateField = (field: FormField, fieldData: FormField | undefined, path: string = ""): boolean => {
      if (!fieldData) {
        console.log(`⚠️ No data found for field ${path || field.name}`);
        return true; // Skip validation if no data
      }
      
      const fieldValue = fieldData.value;
      const fieldPath = path ? `${path}.${field.name}` : field.name;
      let fieldValid = true;
      
      console.log(`🔍 Validating field ${fieldPath}: value = "${fieldValue}", required = ${field.required}`);

      // Recursively validate embedded fields
      if (field.isEmbedded && field.embeddedFields) {
        console.log(`🔍 Validating embedded object ${fieldPath} with ${field.embeddedFields.length} embedded fields`);
        
        field.embeddedFields.forEach(embeddedField => {
          const embeddedFieldData = formData[embeddedField.name];
          const embeddedFieldValid = validateField(embeddedField, embeddedFieldData, fieldPath);
          if (!embeddedFieldValid) {
            fieldValid = false;
          }
        });
      } else {
        // Validate required fields
        if (field.required && (fieldValue === "" || fieldValue === null || fieldValue === undefined)) {
          newFormData[fieldData.name] = { 
            ...fieldData, 
            error: resolveLabel(["form.required"], { entity: listField }, "This field is required") 
          };
          fieldValid = false;
          console.log(`❌ Validation failed for field ${fieldPath}: required field is empty`);
        }

        // Validate numeric fields
        if (field.isNumeric && typeof fieldValue === "string" && isNaN(Number(fieldValue))) {
          newFormData[fieldData.name] = { 
            ...fieldData, 
            error: resolveLabel(["form.invalidNumber"], { entity: listField }, "Must be a valid number") 
          };
          fieldValid = false;
          console.log(`❌ Validation failed for field ${fieldPath}: invalid number`);
        }

        // Validate date fields
        if (field.isDate && typeof fieldValue === "string") {
          const timestamp = new Date(String(fieldValue)).getTime();
          if (isNaN(timestamp)) {
            newFormData[fieldData.name] = { 
              ...fieldData, 
              error: resolveLabel(["form.invalidDate"], { entity: listField }, "Must be a valid date") 
            };
            fieldValid = false;
            console.log(`❌ Validation failed for field ${fieldPath}: invalid date`);
          }
        }

        // Validate object fields (non-embedded)
        if (field.isObject && !field.isEmbedded && field.required && (!fieldValue || fieldValue === "" || fieldValue === null)) {
          newFormData[fieldData.name] = { 
            ...fieldData, 
            error: resolveLabel(["form.required"], { entity: listField }, "This field is required") 
          };
          fieldValid = false;
          console.log(`❌ Validation failed for field ${fieldPath}: required object field is empty`);
        }

        // Clear error if field is valid
        if (fieldData.error && fieldData.error !== "") {
          newFormData[fieldData.name] = { 
            ...fieldData, 
            error: undefined 
          };
          console.log(`✅ Cleared error for field ${fieldPath}`);
        }
      }
      
      return fieldValid;
    };

    // Validate all form fields recursively
    formFields.forEach(field => {
      const fieldData = formData[field.name];
      const fieldValid = validateField(field, fieldData);
      if (!fieldValid) {
        isValid = false;
      }
    });

    setFormData(newFormData);
    return isValid;
  };

  // Clean object fields within collection items to only keep ID for non-embedded objects
  const cleanCollectionItemObjectFields = React.useCallback((item: CollectionItem, collectionField: FormField, schema: SchemaData): CollectionItem => {
    const cleanItem = { ...item };
    
    // Use the collection field information to get the object type
    const objectTypeName = collectionField.collectionObjectTypeName;
    if (!objectTypeName) {
      console.warn('No collection object type name found for field:', collectionField.name);
      return cleanItem;
    }
    
    // Find the actual object type from schema
    const objectType = schema.__schema.types.find(type => 
      type.name === objectTypeName
    );
    
    if (objectType && objectType.fields) {
      console.log(`Cleaning object fields for collection item type: ${objectTypeName}`);
      
      objectType.fields.forEach(fieldDef => {
        const fieldName = fieldDef.name;
        const fieldValue = cleanItem[fieldName];
        
        // Check if this is a state machine field and exclude it from collection item mutations
        const isStateMachineField = fieldDef.extensions?.stateMachine === true;
        if (isStateMachineField) {
          console.log(`🗑️ Removing state machine field ${fieldName} from collection item`);
          delete cleanItem[fieldName];
          return;
        }
        
        if (fieldValue && typeof fieldValue === 'object' && fieldValue !== null) {
          // Check if this is an object field (not embedded)
          const fieldType = fieldDef.type;
          let current = fieldType as { kind?: string; ofType?: unknown; name?: string };
          
          // Unwrap NON_NULL and LIST wrappers to get the underlying type
          while (current && current.kind && (current.kind === "NON_NULL" || current.kind === "LIST")) {
            current = current.ofType as { kind?: string; ofType?: unknown; name?: string };
          }
          
          const isObject = current?.kind === "OBJECT";
          const isEmbedded = fieldDef.extensions?.relation?.embedded === true;
          
          console.log(`Field ${fieldName}: isObject=${isObject}, isEmbedded=${isEmbedded}, type=${current?.name}`);
          
          if (isObject && !isEmbedded && 'id' in fieldValue) {
            // For non-embedded object fields, only keep the ID and remove __typename
            const cleanedObject = { id: (fieldValue as { id: string }).id };
            
            // Remove __typename if it exists
            if ('__typename' in fieldValue) {
              console.log(`🗑️ Removed __typename from object field ${fieldName}`);
            }
            
            cleanItem[fieldName] = cleanedObject;
            console.log(`✅ Cleaned object field ${fieldName} in collection item:`, { 
              fieldName, 
              originalValue: fieldValue, 
              cleanedValue: cleanedObject,
              removedTypename: '__typename' in fieldValue,
              isNonNull: fieldDef.type.kind === "NON_NULL",
              underlyingType: current?.name
            });
          } else if (isObject && isEmbedded) {
            console.log(`🔒 Keeping embedded object field ${fieldName} as-is:`, fieldValue);
          } else if (!isObject) {
            console.log(`📝 Field ${fieldName} is not an object type:`, current?.kind);
          }
        }
      });
    } else {
      console.warn(`Object type ${objectTypeName} not found in schema or has no fields`);
    }
    
    return cleanItem;
  }, []);

  // Recursively clean object fields and remove _typename from nested structures
  const deepCleanCollectionItem = React.useCallback((item: unknown): unknown => {
    if (typeof item !== 'object' || item === null) {
      return item;
    }
    
    // If it's an array, clean each item
    if (Array.isArray(item)) {
      return item.map(deepCleanCollectionItem);
    }
    
    // If it's an object, clean it recursively
    const cleanedItem = { ...item } as Record<string, unknown>;
    
    // Remove __typename from the current level
    if ('__typename' in cleanedItem) {
      console.log(`🗑️ Removed __typename from collection item level`);
      delete cleanedItem.__typename;
    }
    
    // Recursively clean nested properties
    Object.keys(cleanedItem).forEach(key => {
      const value = cleanedItem[key];
      if (typeof value === 'object' && value !== null) {
        cleanedItem[key] = deepCleanCollectionItem(value);
      }
    });
    
    return cleanedItem;
  }, []);

  // Helper function to convert field types in collection items (numeric and date fields)
  const convertCollectionItemTypes = React.useCallback((item: CollectionItem, collectionTypeName: string): CollectionItem => {
    if (!schemaData) return item;
    
    const collectionType = getTypeByName(schemaData as SchemaData, collectionTypeName);
    if (!collectionType?.fields) return item;
    
    const convertedItem = { ...item };
    
    // Check each field in the item
    Object.keys(convertedItem).forEach(key => {
      const field = collectionType.fields?.find(f => f.name === key);
      if (field) {
        const fieldTypeName = unwrapNamedType(field.type);
        const isNumeric = isNumericScalarName(fieldTypeName);
        const isDate = isDateTimeScalarName(fieldTypeName);
        
        // Convert numeric fields from string to number
        if (isNumeric && convertedItem[key] && typeof convertedItem[key] === 'string') {
          convertedItem[key] = Number(convertedItem[key]);
          console.log(`Collection item numeric field ${key} converted to number:`, convertedItem[key]);
        }
        
        // Convert date fields to DateTime format
        if (isDate && convertedItem[key] && typeof convertedItem[key] === 'string') {
          const dateValue = convertedItem[key] as string;
          // Check if it's just a date (YYYY-MM-DD) and not already a full DateTime
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            // Convert to ISO 8601 DateTime (midnight UTC)
            convertedItem[key] = `${dateValue}T00:00:00.000Z`;
            console.log(`Collection item date field ${key} converted to DateTime:`, convertedItem[key]);
          }
        }
      }
    });
    
    return convertedItem;
  }, [schemaData]);

  // Transform collection data for Simfinity mutation
  const transformCollectionDataForMutation = React.useCallback((collectionChanges: Record<string, CollectionFieldState>): Record<string, unknown> => {
    const transformedCollections: Record<string, unknown> = {};
    
    Object.entries(collectionChanges).forEach(([fieldName, changes]) => {
      const field = formFields.find(f => f.name === fieldName);
      if (field && field.isCollection) {
        const transformedCollection: Record<string, unknown> = {};
        
        // Handle added items - remove connection field, __status metadata, and temporary ID, clean object fields
        if (changes.added && changes.added.length > 0) {
          transformedCollection.added = changes.added.map((item: CollectionItem) => {
            let cleanItem = { ...item };
            // Remove metadata fields
            delete cleanItem.__status;
            delete cleanItem.__originalData;
            // Remove connection field if present
            if (field.connectionField && cleanItem[field.connectionField] !== undefined) {
              delete cleanItem[field.connectionField];
            }
            // Remove temporary ID for added items (backend will generate the real ID)
            if (cleanItem.id && typeof cleanItem.id === 'string' && cleanItem.id.startsWith('temp_')) {
              console.log(`🗑️ Removed temporary ID from added item:`, cleanItem.id);
              delete (cleanItem as Record<string, unknown>).id;
            }
            // Convert field types (numeric and date fields)
            if (field.objectTypeName) {
              cleanItem = convertCollectionItemTypes(cleanItem, field.objectTypeName);
            }
            // Clean object fields within the item
            cleanItem = cleanCollectionItemObjectFields(cleanItem, field, schemaData as SchemaData);
            // Also do deep cleaning to remove __typename from nested structures
            cleanItem = deepCleanCollectionItem(cleanItem) as CollectionItem;
            return cleanItem;
          });
          
          console.log(`➕ Transformed added items for ${fieldName}:`, {
            original: changes.added,
            transformed: transformedCollection.added
          });
        }
        
        // Handle updated items - remove connection field and __status metadata, clean object fields
        if (changes.modified && changes.modified.length > 0) {
          transformedCollection.updated = changes.modified.map((item: CollectionItem) => {
            let cleanItem = { ...item };
            // Remove metadata fields
            delete cleanItem.__status;
            delete cleanItem.__originalData;
            // Remove connection field if present
            if (field.connectionField && cleanItem[field.connectionField] !== undefined) {
              delete cleanItem[field.connectionField];
            }
            // Convert field types (numeric and date fields)
            if (field.objectTypeName) {
              cleanItem = convertCollectionItemTypes(cleanItem, field.objectTypeName);
            }
            // Clean object fields within the item
            cleanItem = cleanCollectionItemObjectFields(cleanItem, field, schemaData as SchemaData);
            // Also do deep cleaning to remove __typename from nested structures
            cleanItem = deepCleanCollectionItem(cleanItem) as CollectionItem;
            return cleanItem;
          });
        }
        
        // Handle deleted items - extract only the IDs
        if (changes.deleted && changes.deleted.length > 0) {
          transformedCollection.deleted = changes.deleted.map((item: CollectionItem) => {
            // For deleted items, we only need the ID
            if (typeof item === 'string') {
              // If it's already a string ID, return as-is
              return item;
            } else if (typeof item === 'object' && item !== null && 'id' in item) {
              // If it's an object with an ID, extract just the ID
              return (item as { id: string }).id;
            } else {
              // Fallback: try to get ID from the item
              console.warn('Deleted item does not have expected ID structure:', item);
              return item;
            }
          });
          
          console.log(`🗑️ Transformed deleted items for ${fieldName}:`, {
            original: changes.deleted,
            transformed: transformedCollection.deleted
          });
        }
        
        // Only include collection if there are changes
        if (Object.keys(transformedCollection).length > 0) {
          transformedCollections[fieldName] = transformedCollection;
        }
      }
    });
    
    return transformedCollections;
  }, [formFields, convertCollectionItemTypes, cleanCollectionItemObjectFields, deepCleanCollectionItem, schemaData]);

  // Cache invalidation functions
  const invalidateEntityListCache = React.useCallback(async (entityType: string) => {
    try {
      // Evict all queries that contain the entity type name
      await client.resetStore();
      
      console.log(`🗑️ Invalidated cache for entity type: ${entityType}`);
    } catch (error) {
      console.error(`Error invalidating cache for ${entityType}:`, error);
    }
  }, [client]);

  const invalidateEntityCache = React.useCallback(async (entityId: string, entityType: string) => {
    try {
      // Get the entity name (singular form)
      const entityName = entityType.slice(0, -1); // Remove 's' from end
      
      // Evict the specific entity from cache
      client.cache.evict({ 
        id: client.cache.identify({ 
          __typename: entityName.charAt(0).toUpperCase() + entityName.slice(1), 
          id: entityId 
        }) 
      });
      
      // Also evict any list queries that might contain this entity
      client.cache.gc();
      
      console.log(`🗑️ Invalidated cache for entity ${entityId} of type ${entityType}`);
    } catch (error) {
      console.error(`Error invalidating cache for entity ${entityId}:`, error);
    }
  }, [client]);

  // Transform form data for Simfinity mutation submission
  const transformFormDataForMutation = React.useCallback((formData: FormData, collectionChanges?: Record<string, CollectionFieldState>): Record<string, unknown> => {
    const transformedData: Record<string, unknown> = {};
    
    // First, transform collection fields using the dedicated function
    if (collectionChanges) {
      const transformedCollections = transformCollectionDataForMutation(collectionChanges);
      Object.assign(transformedData, transformedCollections);
    }
    
    // Then transform non-collection fields
    formFields.forEach(field => {
      if (!field.isCollection && !field.isStateMachine) { // Skip collection fields and state machine fields
        if (field.isEmbedded) {
          // Handle embedded object fields (like director in the example)
          const embeddedData: Record<string, unknown> = {};
          if (field.embeddedFields) {
            field.embeddedFields.forEach(embeddedField => {
              const embeddedFieldName = embeddedField.name.replace(`${field.name}.`, '');
              let embeddedFieldValue = formData[embeddedField.name]?.value;
              
              // Convert numeric fields from string to number
              if (embeddedField.isNumeric && embeddedFieldValue && typeof embeddedFieldValue === 'string') {
                embeddedFieldValue = Number(embeddedFieldValue);
                console.log(`Embedded numeric field ${embeddedField.name} converted to number:`, embeddedFieldValue);
              }
              
              // Convert date fields from YYYY-MM-DD to ISO 8601 DateTime format
              if (embeddedField.isDate && embeddedFieldValue && typeof embeddedFieldValue === 'string') {
                // Check if it's just a date (YYYY-MM-DD) and not already a full DateTime
                if (/^\d{4}-\d{2}-\d{2}$/.test(embeddedFieldValue)) {
                  // Convert to ISO 8601 DateTime (midnight UTC)
                  embeddedFieldValue = `${embeddedFieldValue}T00:00:00.000Z`;
                  console.log(`Embedded date field ${embeddedField.name} converted to DateTime:`, embeddedFieldValue);
                }
              }
              
              if (embeddedFieldValue !== undefined && embeddedFieldValue !== null && embeddedFieldValue !== '') {
                embeddedData[embeddedFieldName] = embeddedFieldValue;
              }
            });
          }
          // Only include embedded object if it has data
          if (Object.keys(embeddedData).length > 0) {
            transformedData[field.name] = embeddedData;
            console.log(`Embedded object ${field.name}:`, embeddedData);
          }
        } else if (field.isObject) {
          // Handle object reference fields (like genre in the example: {id: "idofrelatedobject"})
          const currentValue = formData[field.name]?.value;
          if (currentValue && typeof currentValue === 'object' && 'id' in currentValue) {
            // Extract ID from object value
            transformedData[field.name] = { id: (currentValue as { id: string }).id };
            console.log(`Object field ${field.name}:`, { id: (currentValue as { id: string }).id });
          } else if (typeof currentValue === 'string' && currentValue) {
            // Direct ID string
            transformedData[field.name] = { id: currentValue };
            console.log(`Object field ${field.name}:`, { id: currentValue });
          }
        } else {
          // Handle scalar fields (string, number, boolean, list of scalars)
          let currentValue = formData[field.name]?.value;
          
          // Convert numeric fields from string to number
          if (field.isNumeric && currentValue && typeof currentValue === 'string') {
            currentValue = Number(currentValue);
            console.log(`Numeric field ${field.name} converted to number:`, currentValue);
          }
          
          // Convert date fields from YYYY-MM-DD to ISO 8601 DateTime format
          if (field.isDate && currentValue && typeof currentValue === 'string') {
            // Check if it's just a date (YYYY-MM-DD) and not already a full DateTime
            if (/^\d{4}-\d{2}-\d{2}$/.test(currentValue)) {
              // Convert to ISO 8601 DateTime (midnight UTC)
              currentValue = `${currentValue}T00:00:00.000Z`;
              console.log(`Date field ${field.name} converted to DateTime:`, currentValue);
            }
          }
          
          if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
            // For list fields, only include if they actually changed from the original value
            if (field.isList && action === "edit") {
              // In edit mode, compare with original entity data to see if changed
              const originalValue = field.value; // This is the original value from the entity
              
              // Only include list field if it actually changed
              if (JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
                transformedData[field.name] = currentValue;
                console.log(`List field ${field.name} changed:`, { original: originalValue, current: currentValue });
              } else {
                console.log(`List field ${field.name} unchanged, skipping:`, currentValue);
              }
            } else {
              // For non-list fields or create mode, include if they have a value
              transformedData[field.name] = currentValue;
              console.log(`Scalar field ${field.name}:`, currentValue);
            }
          }
        }
      }
    });
    
    return transformedData;
  }, [formFields, transformCollectionDataForMutation, action]);



  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Get entity-level callbacks
    if (!entityTypeName) {
      console.warn('No entity type name found for callbacks');
      return;
    }
    const callbacks = getEntityFormCallbacks(entityTypeName, action);
    
    // Create callback actions
    const callbackActions = createCallbackActions();

    setLoading(true);
    setError(null);
    setFormMessage(null);

    try {
      // Get collection changes for both create and edit modes
      const collectionChanges = getCollectionChanges();
      
      if (Object.keys(collectionChanges).length > 0) {
        console.log('Collection changes to be processed:', collectionChanges);
      }

      // Transform form data for mutation using the new transformation functions
      const transformedData = transformFormDataForMutation(formData, collectionChanges);
      
      console.log('Transformed data for Simfinity mutation:', transformedData);

      // Execute beforeSubmit callback if available
      if (callbacks?.beforeSubmit) {
        try {
          const shouldContinue = await callbacks.beforeSubmit(formData, collectionChanges as Record<string, FormCustomizationCollectionFieldState>, transformedData, callbackActions);
          
          // If callback explicitly returns false, stop form submission
          if (shouldContinue === false) {
            console.log('Form submission cancelled by beforeSubmit callback');
            return;
          }
        } catch (beforeSubmitError) {
          console.error('Error in beforeSubmit callback:', beforeSubmitError);
          // If beforeSubmit throws an error, stop form submission
          return;
        }
      }

      let result: unknown;
      
      if (action === "create") {
        result = await addEntity({
          variables: { input: transformedData }
        });
        console.log('Entity created:', (result as { data: unknown }).data);
        
        // Invalidate and refetch list queries for the entity type
        await invalidateEntityListCache(listField);
      } else if (action === "edit") {
        // For update mutations, include the ID inside the input
        const updateInput = { id: entityId, ...transformedData };
        result = await updateEntity({
          variables: { input: updateInput }
        });
        console.log('Entity updated:', (result as { data: unknown }).data);
        
        // Invalidate and refetch both the specific entity and list queries
        await invalidateEntityCache(entityId!, listField);
        await invalidateEntityListCache(listField);
      }

      // Reset collection state after successful submission
      resetAllCollectionStates();
      console.log('🔄 Reset all collection states after form submission');

      // Execute onSuccess callback if available
      let successResult;
      if (callbacks?.onSuccess) {
        try {
          successResult = await callbacks.onSuccess(result, callbackActions);
        } catch (onSuccessError) {
          console.error('Error in onSuccess callback:', onSuccessError);
        }
      }

      // Handle success result from callback or use default
      if (successResult) {
        if (successResult.message) {
          setSuccessMessage(typeof successResult.message === 'string' ? successResult.message : 'Success');
        }
        
        if (successResult.navigateTo) {
          setTimeout(() => {
            navigate(successResult.navigateTo!);
          }, 1000);
        } else if (successResult.action) {
          successResult.action();
        } else {
          // Default navigation
          setTimeout(() => {
            navigate(`/entities/${listField}`);
          }, 1500);
        }
      } else {
        // Default success handling
        const defaultMessage = action === "create" 
          ? resolveLabel(["form.successCreated"], { entity: listField }, "Entity created successfully!")
          : resolveLabel(["form.successUpdated"], { entity: listField }, "Entity updated successfully!");
        setSuccessMessage(defaultMessage);
        
        // Default redirect back to list
        setTimeout(() => {
          navigate(`/entities/${listField}`);
        }, 1500);
      }
      
    } catch (err: unknown) {
      // Execute onError callback if available
      if (callbacks?.onError) {
        try {
          await callbacks.onError(err, formData, callbackActions);
          // If onError callback is provided, it handles the error completely
          return;
        } catch (onErrorError) {
          console.error('Error in onError callback:', onErrorError);
          // Fall back to default error handling if onError callback fails
        }
      }
      
      // Default error handling
      const errorMessage = err instanceof Error ? err.message : resolveLabel(["form.errorOccurred"], { entity: listField }, "An error occurred");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // State machine handlers
  const handleStateMachineAction = async (actionName: string) => {
    if (!entityTypeName || !entityId) return;
    
    const stateMachineConfig = getEntityStateMachine(entityTypeName);
    if (!stateMachineConfig) return;
    
    const action = stateMachineConfig.actions[actionName];
    if (!action) return;
    
    setStateMachineLoading(actionName);
    setStateMachineMenuAnchor(null);
    
    // Get collection changes and transformed data (same as regular form submission)
    const collectionChanges = getCollectionChanges();
    const transformedData = transformFormDataForMutation(formData, collectionChanges);
    const stateMachineDataInput = { id: entityId, ...transformedData };
    
    try {
      
      // Execute onBeforeSubmit callback if available
      if (action.onBeforeSubmit) {
        const result = await action.onBeforeSubmit(formData, collectionChanges as Record<string, FormCustomizationCollectionFieldState>, stateMachineDataInput, createCallbackActions());
        
        if (!result.shouldProceed) {
          if (result.error) {
            setError(result.error);
          }
          return;
        }
      }
      
      // Execute the state machine mutation
      const mutation = gql`
        mutation ${action.mutation}($input: ${entityTypeName}InputForUpdate!) {
          ${action.mutation}(input: $input) {
            id
            state
          }
        }
      `;
      
      const result = await client.mutate({
        mutation,
        variables: { input: stateMachineDataInput }
      });
      
      // Execute onSuccess callback if available
      if (action.onSuccess) {
        await action.onSuccess(result.data, formData, collectionChanges as Record<string, FormCustomizationCollectionFieldState>, transformedData, createCallbackActions());
      }
      
      // Invalidate and refetch both the specific entity and list queries (same as regular form submission)
      await invalidateEntityCache(entityId!, listField);
      await invalidateEntityListCache(listField);
      
      // Reset collection state after successful state machine action
      resetAllCollectionStates();
      console.log('🔄 Reset all collection states after state machine action');
      
    } catch (error) {
      console.error(`State machine action ${actionName} failed:`, error);
      
      // Execute onError callback if available
      if (action.onError) {
        await action.onError(error as Error, formData, collectionChanges as Record<string, FormCustomizationCollectionFieldState>, transformedData, createCallbackActions());
      } else {
        // Default error handling
        setError(`Failed to ${actionName} entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Render embedded object section using shared FormFieldRenderer
  const renderEmbeddedSection = (field: FormField, enabled: boolean = true) => {
    if (!field.isEmbedded || !field.embeddedFields) return null;
    
    const sectionLabel = getFieldLabel(field.name);
    
    // Get section-level customization (for the embedded object section itself)
    const sectionCustomization = getEmbeddedSectionCustomization(customizationState.customization, field.name);
    const sectionSize = sectionCustomization?.size || { xs: 12, sm: 12, md: 12 }; // Default to full width
    
    // Handle dynamic visible/enabled values for sections
    const sectionVisible = sectionCustomization?.visible;
    const sectionEnabled = sectionCustomization?.enabled;
    
    const isSectionVisible = typeof sectionVisible === 'function' 
      ? sectionVisible(field.name, field.value, formData)
      : (sectionVisible ?? true);
      
    const isSectionEnabled = typeof sectionEnabled === 'function'
      ? sectionEnabled(field.name, field.value, formData)
      : (sectionEnabled ?? true);
    
    if (!isSectionVisible) return null;

    // Check for custom embedded renderer
    const customEmbeddedRenderer = sectionCustomization?.customEmbeddedRenderer;
    if (customEmbeddedRenderer) {
      return (
        <Grid key={field.name} size={sectionSize}>
          {customEmbeddedRenderer(
            field,
            customizationActions,
            handleEmbeddedFieldChange,
            action === "view" || !isSectionEnabled || !enabled,
            formData
          )}
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
                // Get the current value from formData for this embedded field
                const currentValue = formData[embeddedField.name]?.value;
                
                console.log(`Embedded field ${embeddedField.name}: original value =`, embeddedField.value, 'current value from formData =', currentValue);
                
                // Get field-level customization for this embedded field
                const embeddedFieldName = embeddedField.name.replace(`${field.name}.`, '');
                const fieldCustomization = getEmbeddedFieldCustomization(customizationState.customization, field.name, embeddedFieldName);
                const fieldSize = getEmbeddedFieldSize(field.name, embeddedFieldName, customizationState.customization);
                
                // Convert embedded field to the format expected by FormFieldRenderer
                const fieldForRenderer = {
                  name: embeddedFieldName,
                  type: embeddedField.type,
                  isNonNull: embeddedField.required,
                  isList: embeddedField.isList,
                  extensions: { embedded: true }
                };
                
                return (
                  <Grid key={embeddedField.name} size={fieldSize}>
                    <FormFieldRenderer
                      field={fieldForRenderer}
                      value={currentValue !== undefined ? currentValue : embeddedField.value}
                      onChange={(fieldName, value) => {
                        const customOnChange = fieldCustomization?.onChange;
                        
                        if (customOnChange) {
                          // Convert unknown value to the expected type
                          const typedValue = value as string | number | boolean | string[] | null;
                          const result = customOnChange(embeddedFieldName, typedValue, formData, customizationActions.setFieldData, customizationActions.setFieldVisible, customizationActions.setFieldEnabled);
                          // Pass both value and error to handleEmbeddedFieldChange
                          handleEmbeddedFieldChange(field.name, embeddedFieldName, result.value as string | number | boolean | string[] | null, result.error);
                        } else {
                          // Use default handler - ensure value is properly typed
                          const typedValue = value as string | number | boolean | string[] | null;
                          handleEmbeddedFieldChange(field.name, embeddedFieldName, typedValue);
                        }
                      }}
                      error={embeddedField.error}
                      disabled={action === "view" || !isSectionEnabled || !enabled}
                      schemaData={schemaData}
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

  // Render form field
  const renderField = (field: FormField & { onChange?: (value: string | number | boolean | string[] | null) => void }, enabled: boolean = true) => {
    console.log(`Rendering field ${field.name} with value:`, field.value, 'from formData:', formData[field.name]?.value);
    const fieldLabel = getFieldLabel(field.name);
    const isViewMode = action === "view";
    const isStateMachineField = field.isStateMachine === true;
    

    
    // Get field customization for custom onChange and custom renderer
    const fieldCustomization = customizationState.customization[field.name];
    const customOnChange = (typeof fieldCustomization === 'object' && fieldCustomization !== null && 'onChange' in fieldCustomization) ? (fieldCustomization as any).onChange : undefined;
    const customRenderer = (typeof fieldCustomization === 'object' && fieldCustomization !== null && 'customRenderer' in fieldCustomization) ? (fieldCustomization as any).customRenderer : undefined;
    
    // Use custom renderer if provided
    if (customRenderer) {
      return (customRenderer as (field: FormField, actions: FormCustomizationActions, handler: (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => void, disabled: boolean) => React.ReactElement)(
        field,
        customizationActions,
        (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => 
          handleFieldChange(fieldName, value),
        isViewMode || !enabled || isStateMachineField
      );
    }
    
    // Use custom onChange if provided, otherwise use the default handleFieldChange
    const onChange = customOnChange 
      ? (value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => {
          const result = customOnChange(field.name, value, formData, customizationActions.setFieldData, customizationActions.setFieldVisible, customizationActions.setFieldEnabled, undefined);
          // Pass both value and error to handleFieldChange to handle state properly
          handleFieldChange(field.name, result.value as string | number | boolean | string[] | null | { id: string; [key: string]: unknown }, result.error);
        }
      : ((value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => handleFieldChange(field.name, value));
    
    if (field.isObject && field.objectTypeName && field.descriptionField && field.descriptionFieldType && field.listQueryName && field.singleQueryName) {
      return (
        <>
          <ObjectFieldSelector
            label={fieldLabel}
            value={field.value as string | null | { id: string; [key: string]: unknown }}
            onChange={onChange}
            error={field.error}
            required={field.required}
            disabled={isViewMode || !enabled || isStateMachineField}
            objectTypeName={field.objectTypeName}
            descriptionField={field.descriptionField}
            descriptionFieldType={field.descriptionFieldType}
            listQueryName={field.listQueryName}
            singleQueryName={field.singleQueryName}
          />
        </>
      );
    }
    
    if (field.isEnum && field.enumValues) {
      return (
        <>
          <FormControl fullWidth error={!!field.error}>
            <InputLabel>{fieldLabel}</InputLabel>
            <Select
              value={field.value as string}
              onChange={(e) => onChange(e.target.value)}
              label={fieldLabel}
              required={field.required}
              disabled={isViewMode || !enabled || isStateMachineField}
            >
              {field.enumValues.map((enumValue) => (
                <MenuItem key={enumValue} value={enumValue}>
                  {enumValue}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {field.error && (
            <FormHelperText error>{field.error}</FormHelperText>
          )}
        </>
      );
    }
    
    if (field.isList) {
      return (
        <>
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={field.value as string[]}
            onChange={(_, newValue) => onChange(newValue)}
            disabled={isViewMode || !enabled || isStateMachineField}
            slotProps={{
              chip: {
                variant: "outlined"
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={fieldLabel}
                error={!!field.error}
                helperText={field.error}
                required={field.required}
              />
            )}
          />
        </>
      );
    }
    
    if (field.isBoolean) {
      return (
        <>
          <FormControlLabel
            control={
              <input
                type="checkbox"
                checked={field.value as boolean}
                onChange={(e) => onChange(e.target.checked)}
                disabled={isViewMode || !enabled || isStateMachineField}
              />
            }
            label={fieldLabel}
          />
          {field.error && (
            <FormHelperText error>{field.error}</FormHelperText>
          )}
        </>
      );
    }

    if (field.isDate) {
      // Format date value for date input (YYYY-MM-DD)
      const formatDateForInput = (dateValue: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }): string => {
        if (!dateValue || typeof dateValue !== 'string') return '';
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return '';
          return date.toISOString().split('T')[0]; // YYYY-MM-DD format
        } catch {
          return '';
        }
      };

      return (
        <>
          <TextField
            fullWidth
            label={fieldLabel}
            type="date"
            value={formatDateForInput(field.value as string | number | boolean | string[] | null | { id: string; [key: string]: unknown })}
            onChange={(e) => onChange(e.target.value as string | number | boolean | string[] | null | { id: string; [key: string]: unknown })}
            error={!!field.error}
            helperText={field.error}
            required={field.required}
            disabled={isViewMode || !enabled || isStateMachineField}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </>
      );
    }

    return (
      <>
        <TextField
          fullWidth
          label={fieldLabel}
          type={field.isNumeric ? "number" : "text"}
          value={field.value as string}
          onChange={(e) => onChange(e.target.value as string | number | boolean | string[] | null | { id: string; [key: string]: unknown })}
          error={!!field.error}
          helperText={field.error}
          required={field.required}
          disabled={isViewMode || !enabled || isStateMachineField}
        />
      </>
    );
  };

  // Loading states
  if (schemaLoading || !schemaData || entityLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
        {schemaError && (
          <Box sx={{ ml: 2 }}>
            <Typography color="error">Schema Error: {schemaError.message}</Typography>
          </Box>
        )}
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

  console.log('Current formData state:', formData);
  console.log('Form fields to render:', formFields.map(f => ({ name: f.name, value: f.value })));

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link href={`/entities/${listField}`} color="inherit">
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

      {/* Title and Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {action === "create" 
            ? resolveLabel(["form.create"], { entity: listField }, "Create")
            : action === "edit" 
            ? resolveLabel(["form.edit"], { entity: listField }, "Edit")
            : resolveLabel(["form.view"], { entity: listField }, "View")
          } {resolveLabel([getEntityName(listField, 'single')], { entity: listField }, getEntityName(listField, 'single'))}
        </Typography>
        
        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate(`/entities/${listField}`)}
          >
            {resolveLabel(["form.cancel"], { entity: listField }, "Cancel")}
          </Button>
          
          {/* State Machine Actions Button */}
          {action === "edit" && entityTypeName && hasStateMachineSupport(entityTypeName) && entityData && (
            (() => {
              const currentState = entityData[entityTypeName].state;
              const availableActions = getAvailableStateMachineActions(entityTypeName, currentState);
              
              if (availableActions.length > 0) {
                return (
                  <Button
                    variant="outlined"
                    onClick={handleStateMachineMenuOpen}
                    disabled={stateMachineLoading !== null}
                    startIcon={stateMachineLoading ? <CircularProgress size={16} /> : undefined}
                  >
                    {resolveLabel(["stateMachine.actions"], { entity: listField }, "Actions")}
                  </Button>
                );
              }
              return null;
            })()
          )}
          
          {action !== "view" && customizationState.customization.mode !== 'stepper' && (
            <Button
              type="submit"
              variant="contained"
              disabled={loading || createLoading || updateLoading}
              form="entity-form"
            >
              {loading || createLoading || updateLoading ? <CircularProgress size={20} /> : action === "create" 
                ? resolveLabel(["form.create"], { entity: listField }, "Create")
                : resolveLabel(["form.update"], { entity: listField }, "Update")
              }
            </Button>
          )}
        </Box>
      </Box>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {formMessage && (
        <Alert severity={formMessage.type} sx={{ mb: 2 }}>
          {typeof formMessage.message === 'string' ? formMessage.message : formMessage.message}
        </Alert>
      )}

                {/* Form */}
          {(() => {
            const isStepperMode = customizationState.customization.mode === 'stepper';
            const steps = customizationState.customization.steps || [];
            
            // Handler for stepper navigation
            const handleStepClick = (stepIndex: number) => {
              setCurrentStepIndex(stepIndex);
            };
            
            const handleNextStep = () => {
              if (currentStepIndex < steps.length - 1) {
                setCurrentStepIndex(currentStepIndex + 1);
              }
            };
            
            const handlePreviousStep = () => {
              if (currentStepIndex > 0) {
                setCurrentStepIndex(currentStepIndex - 1);
              }
            };
            
            // Render stepper mode
            if (isStepperMode && steps.length > 0) {
              const currentStep = steps[currentStepIndex];
              const currentStepId = currentStep?.stepId;
              
              // Convert steps to the format expected by CustomStepper
              const stepperSteps = steps.map((step, index) => ({
                id: index + 1,
                label: resolveLabel([step.stepLabel], { entity: listField }, step.stepLabel),
              }));
              
              return (
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  {/* Stepper component on the left (or top on mobile) */}
                  <CustomStepper
                    activeStep={currentStepIndex}
                    steps={stepperSteps}
                    handleStepClick={handleStepClick}
                    variant={action === "create" ? variants.classic : variants.linear}
                    allowClickBack={true}
                  />
                  
                  {/* Form content on the right */}
                  <Paper sx={{ p: 3, flex: 1 }}>
                    <form id="entity-form" onSubmit={handleSubmit}>
                      {/* Render custom step renderer if available */}
                      {currentStep?.customStepRenderer ? (
                        currentStep.customStepRenderer()
                      ) : (
                        <>
                          <Grid container spacing={3}>
                            {(() => {
                              const mainFormFields = formFields.filter(field => !field.isCollection);
                              
                              // Get ordered fields based on customization
                              const orderedFields = getFieldOrder(customizationState);
                              const visibleFields = mainFormFields.filter(field => 
                                isFieldVisible(field.name, customizationState, field.value, formData)
                              );
                              
                              // Filter fields for current step
                              const stepFields = visibleFields.filter(field => {
                                const fieldCustomization = customizationState.customization[field.name];
                                if (typeof fieldCustomization === 'object' && fieldCustomization !== null && 'stepId' in fieldCustomization) {
                                  return (fieldCustomization as { stepId?: string }).stepId === currentStepId;
                                }
                                return false;
                              });
                              
                              // Sort fields according to customization order
                              const sortedFields = stepFields.sort((a, b) => {
                                const aIndex = orderedFields.indexOf(a.name);
                                const bIndex = orderedFields.indexOf(b.name);
                                if (aIndex === -1 && bIndex === -1) return 0;
                                if (aIndex === -1) return 1;
                                if (bIndex === -1) return -1;
                                return aIndex - bIndex;
                              });
                              
                              return sortedFields.map(field => {
                                // Get field customization properties
                                const fieldSize = getFieldSize(field.name, customizationState.customization);
                                const isEnabled = isFieldEnabled(field.name, customizationState, field.value, formData);
                                
                                // Handle embedded object fields as sections
                                if (field.isEmbedded) {
                                  return null;
                                }
                                
                                // Handle regular fields with customization
                                return (
                                  <Grid key={field.name} size={fieldSize}>
                                    {renderField(formData[field.name] || field, isEnabled)}
                                  </Grid>
                                );
                              });
                            })()}
                          </Grid>

                          {/* Embedded Object Sections for current step */}
                          {(() => {
                            const embeddedFields = formFields.filter(field => {
                              if (!field.isEmbedded) return false;
                              const fieldCustomization = customizationState.customization[field.name];
                              if (typeof fieldCustomization === 'object' && fieldCustomization !== null && 'stepId' in fieldCustomization) {
                                return (fieldCustomization as { stepId?: string }).stepId === currentStepId;
                              }
                              return false;
                            });
                            
                            if (embeddedFields.length === 0) return null;
                            
                            const sortedEmbeddedFields = embeddedFields.sort((a, b) => {
                              const aCustomization = getEmbeddedSectionCustomization(customizationState.customization, a.name);
                              const bCustomization = getEmbeddedSectionCustomization(customizationState.customization, b.name);
                              
                              const aOrder = aCustomization?.order ?? 999;
                              const bOrder = bCustomization?.order ?? 999;
                              
                              return aOrder - bOrder;
                            });
                            
                            return (
                              <>
                                <Divider sx={{ my: 3 }} />
                                {sortedEmbeddedFields.map(field => renderEmbeddedSection(field, true))}
                              </>
                            );
                          })()}

                          {/* Collection Fields for current step */}
                          {(() => {
                            const collectionFields = formFields.filter(field => {
                              if (!field.isCollection || !field.collectionObjectTypeName || !field.connectionField) return false;
                              const fieldCustomization = customizationState.customization[field.name];
                              if (typeof fieldCustomization === 'object' && fieldCustomization !== null && 'stepId' in fieldCustomization) {
                                return (fieldCustomization as { stepId?: string }).stepId === currentStepId;
                              }
                              return false;
                            });
                            
                            if (collectionFields.length === 0) return null;
                            
                            return (
                              <>
                                {collectionFields.map(field => {
                                  // Check for custom collection renderer
                                  const collectionCustomization = getCollectionFieldCustomization(customizationState.customization, field.name);
                                  const customCollectionRenderer = collectionCustomization?.customCollectionRenderer;
                                  
                                  if (customCollectionRenderer) {
                                    return (
                                      <Box key={field.name} sx={{ mt: 3 }}>
                                        {customCollectionRenderer(
                                          field.name,
                                          parentFormAccess,
                                          getCollectionState(field.name) as unknown as Record<string, unknown>,
                                          (newState: Record<string, unknown>) => updateCollectionState(field.name, newState as unknown as CollectionFieldState),
                                          entityId || null,
                                          action === "edit"
                                        )}
                                      </Box>
                                    );
                                  }
                                  
                                  // Default collection rendering
                                  return (
                                    <Box key={field.name} sx={{ mt: 3 }}>
                                      <CollectionFieldGrid
                                        collectionField={{
                                          name: field.name,
                                          objectTypeName: field.collectionObjectTypeName!,
                                          connectionField: field.connectionField!,
                                        }}
                                        parentEntityId={entityId || ""}
                                        parentEntityType={entityTypeName || ""}
                                        isEditMode={action === "edit"}
                                        collectionState={getCollectionState(field.name)}
                                        onCollectionStateChange={updateCollectionState}
                                        parentFormAccess={parentFormAccess}
                                      />
                                    </Box>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </>
                      )}
                      
                      {/* Navigation buttons */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePreviousStep();
                          }}
                          disabled={currentStepIndex === 0}
                          variant="outlined"
                        >
                          {resolveLabel(["form.back"], { entity: listField }, "Back")}
                        </Button>
                        
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {currentStepIndex === steps.length - 1 && action !== "view" ? (
                            <Button
                              type="submit"
                              variant="contained"
                              disabled={loading || createLoading || updateLoading}
                            >
                              {loading || createLoading || updateLoading ? <CircularProgress size={20} /> : action === "create" 
                                ? resolveLabel(["form.create"], { entity: listField }, "Create")
                                : resolveLabel(["form.update"], { entity: listField }, "Update")
                              }
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleNextStep();
                              }}
                              disabled={currentStepIndex === steps.length - 1}
                              variant="contained"
                            >
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
            
            // Render default mode
            return (
              <Paper sx={{ p: 3 }}>
                <form id="entity-form" onSubmit={handleSubmit}>
                  <Grid container spacing={3} >
                    {(() => {
                      const mainFormFields = formFields.filter(field => !field.isCollection);
                      const collectionFields = formFields.filter(field => field.isCollection);
                      
                      console.log('Form rendering:', {
                        mainFormFields: mainFormFields.map(f => f.name),
                        collectionFields: collectionFields.map(f => ({ name: f.name, collectionObjectTypeName: f.collectionObjectTypeName, connectionField: f.connectionField }))
                      });
                      
                      // Get ordered fields based on customization
                      const orderedFields = getFieldOrder(customizationState);
                      const visibleFields = mainFormFields.filter(field => isFieldVisible(field.name, customizationState, field.value, formData));
                      
                      // Sort fields according to customization order
                      const sortedFields = visibleFields.sort((a, b) => {
                        const aIndex = orderedFields.indexOf(a.name);
                        const bIndex = orderedFields.indexOf(b.name);
                        if (aIndex === -1 && bIndex === -1) return 0;
                        if (aIndex === -1) return 1;
                        if (bIndex === -1) return -1;
                        return aIndex - bIndex;
                      });
                      
                      return sortedFields.map(field => {
                        // Get field customization properties
                        const fieldSize = getFieldSize(field.name, customizationState.customization);
                        const isEnabled = isFieldEnabled(field.name, customizationState, field.value, formData);
                        
                        // Handle embedded object fields as sections - these will be rendered separately at the bottom
                        if (field.isEmbedded) {
                          return null; // Don't render embedded sections here
                        }
                        
                        // Handle regular fields with customization
                        return (
                          <Grid key={field.name} size={fieldSize}>
                            {renderField(formData[field.name] || field, isEnabled)}
                          </Grid>
                        );
                      });
                    })()}
                  </Grid>

              {/* Embedded Object Sections - Rendered at the bottom */}
              {(() => {
                const embeddedFields = formFields.filter(field => field.isEmbedded);
                if (embeddedFields.length === 0) return null;
                
                // Sort embedded fields by their customization order
                const sortedEmbeddedFields = embeddedFields.sort((a, b) => {
                  const aCustomization = getEmbeddedSectionCustomization(customizationState.customization, a.name);
                  const bCustomization = getEmbeddedSectionCustomization(customizationState.customization, b.name);
                  
                  const aOrder = aCustomization?.order ?? 999;
                  const bOrder = bCustomization?.order ?? 999;
                  
                  return aOrder - bOrder;
                });
                
                return (
                  <>
                    <Divider sx={{ my: 3 }} />
                    {sortedEmbeddedFields.map(field => renderEmbeddedSection(field, true))}
                  </>
                );
              })()}


            </form>
          </Paper>
            );
          })()}

      {/* Collection Fields (only for non-stepper mode) */}
      {(() => {
        const isStepperMode = customizationState.customization.mode === 'stepper';
        
        // In stepper mode, all fields must have a stepId to be displayed
        // Only render collection fields here if NOT in stepper mode
        if (isStepperMode) return null;
        
        const validCollectionFields = formFields.filter(field => 
          field.isCollection && field.collectionObjectTypeName && field.connectionField
        );
        
        console.log('Rendering collection fields:', {
          totalCollectionFields: formFields.filter(f => f.isCollection).length,
          validCollectionFields: validCollectionFields.map(f => ({
            name: f.name,
            collectionObjectTypeName: f.collectionObjectTypeName,
            connectionField: f.connectionField
          })),
          invalidCollectionFields: formFields.filter(f => f.isCollection && (!f.collectionObjectTypeName || !f.connectionField)).map(f => ({
            name: f.name,
            collectionObjectTypeName: f.collectionObjectTypeName,
            connectionField: f.connectionField
          }))
        });
        
        return validCollectionFields.map(field => {
          // Check for custom collection renderer
          const collectionCustomization = getCollectionFieldCustomization(customizationState.customization, field.name);
          const customCollectionRenderer = collectionCustomization?.customCollectionRenderer;
          
          if (customCollectionRenderer) {
            return (
              <Box key={field.name} sx={{ mt: 3 }}>
                {customCollectionRenderer(
                  field.name,
                  parentFormAccess,
                  getCollectionState(field.name) as unknown as Record<string, unknown>,
                  (newState: Record<string, unknown>) => updateCollectionState(field.name, newState as unknown as CollectionFieldState),
                  entityId || null,
                  action === "edit"
                )}
              </Box>
            );
          }
          
          // Default collection rendering
          return (
            <Box key={field.name} sx={{ mt: 3 }}>
              <CollectionFieldGrid
                collectionField={{
                  name: field.name,
                  objectTypeName: field.collectionObjectTypeName!,
                  connectionField: field.connectionField!,
                }}
                parentEntityId={entityId || ""}
                parentEntityType={entityTypeName || ""}
                isEditMode={action === "edit"}
                collectionState={getCollectionState(field.name)}
                onCollectionStateChange={updateCollectionState}
                parentFormAccess={parentFormAccess}
              />
            </Box>
          );
        });
      })()}

      {/* State Machine Actions Menu */}
      {entityTypeName && hasStateMachineSupport(entityTypeName) && entityData && (
        <Menu
          anchorEl={stateMachineMenuAnchor}
          open={Boolean(stateMachineMenuAnchor)}
          onClose={handleStateMachineMenuClose}
        >
          {(() => {
            const currentState = entityData[entityTypeName].state;
            const availableActions = getAvailableStateMachineActions(entityTypeName, currentState);
            
            return availableActions.map(({ name }) => (
              <MenuItem
                key={name}
                onClick={() => handleStateMachineAction(name)}
                disabled={stateMachineLoading === name}
              >
                {stateMachineLoading === name ? (
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                ) : null}
                {resolveStateMachineActionLabel(resolveLabel, entityTypeName, name, name)}
              </MenuItem>
            ));
          })()}
        </Menu>
      )}

      {/* Snackbar for success messages */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Helper function to get default values
function getDefaultValue(typeName: string | null, isBoolean: boolean, isList: boolean, isObject: boolean): string | number | boolean | string[] | null {
  if (isObject) return null;
  if (isList) return [];
  if (isBoolean) return false;
  if (typeName === "Int" || typeName === "Float") return 0;
  return "";
}
