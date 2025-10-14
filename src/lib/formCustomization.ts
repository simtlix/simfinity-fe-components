import * as React from 'react';

export type FieldSize = {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

// Message types for form-level messages
export type MessageType = 'error' | 'warning' | 'info' | 'success';

// Form message interface
export type FormMessage = {
  type: MessageType;
  message: string | React.ReactNode;
};

// Collection changes type (from useCollectionState)
export type CollectionFieldState = {
  added: Array<{
    id?: string;
    [key: string]: unknown;
    __status?: 'original' | 'added' | 'modified' | 'deleted';
    __originalData?: Record<string, unknown>;
  }>;
  modified: Array<{
    id?: string;
    [key: string]: unknown;
    __status?: 'original' | 'added' | 'modified' | 'deleted';
    __originalData?: Record<string, unknown>;
  }>;
  deleted: Array<{
    id?: string;
    [key: string]: unknown;
    __status?: 'original' | 'added' | 'modified' | 'deleted';
    __originalData?: Record<string, unknown>;
  }>;
};

// Entity-level callback functions
export type EntityFormCallbacks = {
  // Called before create/update operations
  // Return false to prevent form submission, true or undefined to continue
  beforeSubmit?: (
    formData: Record<string, unknown>,
    collectionChanges: Record<string, CollectionFieldState>,
    transformedData: Record<string, unknown>,
    actions: EntityFormCallbackActions
  ) => boolean | void | Promise<boolean | void>;
  
  // Called after successful create/update operations
  onSuccess?: (
    result: unknown,
    actions: EntityFormCallbackActions
  ) => EntityFormSuccessResult | void | Promise<EntityFormSuccessResult | void>;
  
  // Called when errors occur (overrides default error handling)
  onError?: (
    error: unknown,
    formData: Record<string, unknown>,
    actions: EntityFormCallbackActions
  ) => void | Promise<void>;
};

// Unified actions available in all customization contexts
export type FormActions = {
  setFieldData: (fieldName: string, value: unknown) => void;
  setFieldVisible: (fieldName: string, visible: boolean) => void;
  setFieldEnabled: (fieldName: string, enabled: boolean) => void;
  setFieldOrder: (fieldOrder: string[]) => void;
  setCollectionChanges: (fieldName: string, changes: CollectionFieldState) => void;
  setFormMessage: (message: FormMessage) => void;
  setError: (errorMessage: string) => void;
};

// Legacy aliases for backwards compatibility
export type EntityFormCallbackActions = FormActions;
export type FormCustomizationActions = FormActions;

// Result from afterSuccess callback
export type EntityFormSuccessResult = {
  message?: string | React.ReactNode;
  navigateTo?: string;
  action?: () => void;
};

// Form field structure for custom renderers
export type FormField = {
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
};

export type FieldCustomization = {
  size?: FieldSize;
  enabled?: boolean | ((fieldName: string, value: unknown, formData: Record<string, unknown>) => boolean);
  visible?: boolean | ((fieldName: string, value: unknown, formData: Record<string, unknown>) => boolean);
  order?: number;
  stepId?: string; // Optional: step where this field should be displayed in stepper mode
  transient?: boolean; // Optional: if true, field is not included in mutations (requires customRenderer)
  onChange?: (
    fieldName: string,
    value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown },
    formData: Record<string, unknown>,
    setFieldData: (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => void,
    setFieldVisible: (fieldName: string, visible: boolean) => void,
    setFieldEnabled: (fieldName: string, enabled: boolean) => void,
    parentFormAccess?: ParentFormAccess // Optional: only available in collection item context
  ) => { value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }; error?: string };
  customRenderer?: (
    field: FormField,
    customizationActions: FormCustomizationActions,
    handleFieldChange: (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => void,
    disabled: boolean,
    formData: Record<string, unknown>
  ) => React.ReactElement;
};

export type EmbeddedSectionCustomization = {
  size?: FieldSize; // Controls the section's size in the main form
  order?: number;   // Controls the section's order relative to other fields/sections
  visible?: boolean | ((fieldName: string, value: unknown, formData: Record<string, unknown>) => boolean); // Controls whether the entire section is visible
  enabled?: boolean | ((fieldName: string, value: unknown, formData: Record<string, unknown>) => boolean); // Controls whether the entire section is enabled
  customEmbeddedRenderer?: (
    field: FormField,
    customizationActions: FormCustomizationActions,
    handleEmbeddedFieldChange: (sectionName: string, fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }, error?: string) => void,
    disabled: boolean,
    formData: Record<string, unknown>
  ) => React.ReactElement;
};

// Parent form access for collection item callbacks
export type ParentFormAccess = {
  parentFormData: Record<string, unknown>;
  parentFieldVisibility: Record<string, boolean>;
  parentFieldEnabled: Record<string, boolean>;
  setParentFieldData: (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => void;
  setParentFieldVisible: (fieldName: string, visible: boolean) => void;
  setParentFieldEnabled: (fieldName: string, enabled: boolean) => void;
};

// Collection item mode-specific customization
export type CollectionItemModeCustomization = {
  fieldsCustomization?: Record<string, FieldCustomization>;
  onSubmit?: (
    item: Record<string, unknown>,
    setFieldData: (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => void,
    formData: Record<string, unknown>,
    setFieldVisible: (fieldName: string, visible: boolean) => void,
    setFieldEnabled: (fieldName: string, enabled: boolean) => void,
    setMessage: (message: FormMessage) => void,
    parentFormAccess: ParentFormAccess
  ) => boolean | void | Promise<boolean | void>;
};

export type CollectionItemCustomization = {
  size?: FieldSize;
  enabled?: boolean | ((fieldName: string, value: unknown, formData: Record<string, unknown>) => boolean);
  visible?: boolean | ((fieldName: string, value: unknown, formData: Record<string, unknown>) => boolean);
  order?: number;
  onChange?: (
    fieldName: string,
    value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown },
    formData: Record<string, unknown>,
    setFieldData: (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => void,
    setFieldVisible: (fieldName: string, visible: boolean) => void,
    setFieldEnabled: (fieldName: string, enabled: boolean) => void,
    parentFormAccess?: ParentFormAccess // Optional: only available in collection item context
  ) => { value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }; error?: string };
  // Mode-specific customizations for collection items
  onEdit?: CollectionItemModeCustomization;
  onCreate?: CollectionItemModeCustomization;
  // Legacy support - will be deprecated
  fields?: Record<string, FieldCustomization>;
};

export type CollectionFieldCustomization = {
  size?: FieldSize; // Controls the collection section's size in the main form
  order?: number;   // Controls the collection section's order relative to other fields/sections
  visible?: boolean | ((fieldName: string, value: unknown, formData: Record<string, unknown>) => boolean); // Controls whether the entire collection section is visible
  enabled?: boolean | ((fieldName: string, value: unknown, formData: Record<string, unknown>) => boolean); // Controls whether the entire collection section is enabled
  // Callback for when delete button is pressed on a collection item
  onDelete?: (
    item: Record<string, unknown>,
    setMessage: (message: FormMessage) => void
  ) => boolean | void | Promise<boolean | void>;
  // Custom renderer for the entire collection field
  customCollectionRenderer?: (
    collectionFieldName: string,
    parentFormAccess: ParentFormAccess,
    collectionState: Record<string, unknown>, // Compatible with CollectionFieldGrid's CollectionFieldState
    onCollectionStateChange: (newState: Record<string, unknown>) => void, // Compatible with CollectionFieldGrid's CollectionFieldState
    parentEntityId: string | null,
    isEditMode: boolean
  ) => React.ReactElement;
  // Mode-specific customizations for collection items
  onEdit?: CollectionItemModeCustomization;    // Edit mode customizations for collection item fields
  onCreate?: CollectionItemModeCustomization;  // Create mode customizations for collection item fields
  // Legacy support - will be deprecated
  items?: Record<string, CollectionItemCustomization>;
};

// Separate type for entity callbacks to avoid index signature conflicts
export type EntityCallbacksOnly = {
  beforeSubmit?: EntityFormCallbacks['beforeSubmit'];
  onSuccess?: EntityFormCallbacks['onSuccess'];
  onError?: EntityFormCallbacks['onError'];
};

export type FormCustomizationBase = {
  mode?: FormDisplayMode;
  steps?: FormStep[];
  beforeSubmit?: EntityFormCallbacks['beforeSubmit'];
  onSuccess?: EntityFormCallbacks['onSuccess'];
  onError?: EntityFormCallbacks['onError'];
};

export type FormCustomization = FormCustomizationBase & {
  [key: string]: FieldCustomization | EmbeddedSectionCustomization | CollectionFieldCustomization | FormDisplayMode | FormStep[] | EntityFormCallbacks['beforeSubmit'] | EntityFormCallbacks['onSuccess'] | EntityFormCallbacks['onError'] | undefined;
};

export type FormCustomizationState = {
  customization: FormCustomization;
  fieldVisibility: Record<string, boolean>;
  fieldEnabled: Record<string, boolean>;
  fieldOrder: string[];
};

// Step action for custom buttons in stepper mode
export type StepAction = {
  name: string; // Unique identifier for the action
  renderer: (
    actions: EntityFormCallbackActions,
    formData: Record<string, unknown>,
    collectionChanges: Record<string, CollectionFieldState>,
    action: "create" | "edit" | "view"
  ) => React.ReactElement; // Custom renderer for the action button
};

// Step configuration for stepper mode
export type FormStep = {
  stepId: string;
  stepLabel: string;
  customStepRenderer?: (
    customizationActions: FormCustomizationActions,
    handleFieldChange: (fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }) => void,
    handleEmbeddedFieldChange: (sectionName: string, fieldName: string, value: string | number | boolean | string[] | null | { id: string; [key: string]: unknown }, error?: string) => void,
    disabled: boolean,
    formData: Record<string, unknown>
  ) => React.ReactElement; // Custom renderer for the step (e.g., confirmation page)
  actions?: StepAction[]; // Custom action buttons rendered next to Next button
  // Called when Next button is clicked (before navigation)
  // Return false to prevent navigation to next step, true or undefined to continue
  onNext?: (
    formData: Record<string, unknown>,
    collectionChanges: Record<string, CollectionFieldState>,
    transformedData: Record<string, unknown>,
    actions: EntityFormCallbackActions
  ) => boolean | void | Promise<boolean | void>;
  // Called when Back button is clicked (before navigation)
  // Return false to prevent navigation to previous step, true or undefined to continue
  onBack?: (
    formData: Record<string, unknown>,
    collectionChanges: Record<string, CollectionFieldState>,
    transformedData: Record<string, unknown>,
    actions: EntityFormCallbackActions
  ) => boolean | void | Promise<boolean | void>;
};

export type FormDisplayMode = 'default' | 'stepper';

// Global registry for form customizations
// Key format: "entityType:mode" (e.g., "episode:create", "episode:edit")
const formCustomizations = new Map<string, FormCustomization>();

export type FormCustomizationConfig = EntityCallbacksOnly & {
  mode?: FormDisplayMode; // Display mode: 'default' or 'stepper'
  steps?: FormStep[]; // Steps configuration for stepper mode
  fieldsCustomization?: Record<string, FieldCustomization | EmbeddedSectionCustomization | CollectionFieldCustomization>;
};

export function registerFormCustomization(
  entityType: string,
  mode: "create" | "edit" | "view",
  config: FormCustomizationConfig
): void {
  const key = `${entityType}:${mode}`;
  
  const customization: FormCustomization = {
    ...(config.fieldsCustomization || {}),
    ...(config.beforeSubmit && { beforeSubmit: config.beforeSubmit }),
    ...(config.onSuccess && { onSuccess: config.onSuccess }),
    ...(config.onError && { onError: config.onError }),
    ...(config.mode && { mode: config.mode }),
    ...(config.steps && { steps: config.steps })
  } as FormCustomization;
  
  console.log(`Registering form customization for ${entityType} in ${mode} mode:`, customization);
  formCustomizations.set(key, customization);
}

export function getFormCustomization(entityType: string, mode: "create" | "edit" | "view"): FormCustomization | undefined {
  const key = `${entityType}:${mode}`;
  return formCustomizations.get(key);
}

// Helper function to get entity-level callbacks
export function getEntityFormCallbacks(entityType: string, mode: "create" | "edit" | "view"): EntityFormCallbacks | undefined {
  const customization = getFormCustomization(entityType, mode);
  if (!customization) return undefined;
  
  return {
    beforeSubmit: customization.beforeSubmit,
    onSuccess: customization.onSuccess,
    onError: customization.onError,
  };
}

export function createFormCustomizationState(
  entityType: string,
  mode: "create" | "edit" | "view",
  fieldNames: string[]
): FormCustomizationState {
  const customization = getFormCustomization(entityType, mode) || {};
  
  // Initialize field visibility and enabled state
  const fieldVisibility: Record<string, boolean> = {};
  const fieldEnabled: Record<string, boolean> = {};
  
  fieldNames.forEach(fieldName => {
    const fieldCustomization = customization[fieldName];
    
    if (isFieldCustomization(fieldCustomization) || isEmbeddedSectionCustomization(fieldCustomization)) {
      // Handle dynamic visible/enabled values
      const visible = fieldCustomization?.visible;
      const enabled = fieldCustomization?.enabled;
      
      // For static values, store them; for dynamic functions, store default true
      fieldVisibility[fieldName] = typeof visible === 'function' ? true : (visible ?? true);
      fieldEnabled[fieldName] = typeof enabled === 'function' ? true : (enabled ?? true);
    } else {
      fieldVisibility[fieldName] = true;
      fieldEnabled[fieldName] = true;
    }
  });
  
  // Create field order based on customization or default order
  const fieldOrder = fieldNames.sort((a, b) => {
    const aCustomization = customization[a];
    const bCustomization = customization[b];
    
    let aOrder: number | undefined;
    let bOrder: number | undefined;
    
    if (isFieldCustomization(aCustomization) || isEmbeddedSectionCustomization(aCustomization)) {
      aOrder = aCustomization?.order;
    }
    
    if (isFieldCustomization(bCustomization) || isEmbeddedSectionCustomization(bCustomization)) {
      bOrder = bCustomization?.order;
    }
    
    // If both have order, sort by order
    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder;
    }
    
    // If only one has order, prioritize it
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    
    // Default order
    return 0;
  });
  
  return {
    customization,
    fieldVisibility,
    fieldEnabled,
    fieldOrder,
  };
}

// Type guard for field customization
function isFieldCustomization(value: unknown): value is FieldCustomization {
  return typeof value === 'object' && value !== null && ('onChange' in value || 'customRenderer' in value || 'size' in value || 'enabled' in value || 'visible' in value || 'order' in value || 'stepId' in value);
}

// Type guard for embedded section customization
function isEmbeddedSectionCustomization(value: unknown): value is EmbeddedSectionCustomization {
  return typeof value === 'object' && value !== null && !('onChange' in value) && ('customEmbeddedRenderer' in value || ('size' in value || 'order' in value || 'visible' in value || 'enabled' in value));
}

export function getFieldSize(fieldName: string, customization: FormCustomization): FieldSize {
  const fieldCustomization = customization[fieldName];
  if (isFieldCustomization(fieldCustomization) || isEmbeddedSectionCustomization(fieldCustomization)) {
    return fieldCustomization?.size || { xs: 12, sm: 6, md: 4 };
  }
  return { xs: 12, sm: 6, md: 4 };
}

export function isFieldVisible(fieldName: string, state: FormCustomizationState, currentValue?: unknown, formData?: Record<string, unknown>): boolean {
  const fieldCustomization = state.customization[fieldName];
  if (!isFieldCustomization(fieldCustomization) && !isEmbeddedSectionCustomization(fieldCustomization)) {
    return state.fieldVisibility[fieldName] ?? true;
  }
  
  const visible = fieldCustomization?.visible;
  
  if (typeof visible === 'function') {
    return visible(fieldName, currentValue, formData || {});
  }
  
  return state.fieldVisibility[fieldName] ?? (visible ?? true);
}

export function isFieldEnabled(fieldName: string, state: FormCustomizationState, currentValue?: unknown, formData?: Record<string, unknown>): boolean {
  const fieldCustomization = state.customization[fieldName];
  if (!isFieldCustomization(fieldCustomization) && !isEmbeddedSectionCustomization(fieldCustomization)) {
    return state.fieldEnabled[fieldName] ?? true;
  }
  
  const enabled = fieldCustomization?.enabled;
  
  if (typeof enabled === 'function') {
    return enabled(fieldName, currentValue, formData || {});
  }
  
  return state.fieldEnabled[fieldName] ?? (enabled ?? true);
}

export function getFieldOrder(state: FormCustomizationState): string[] {
  return state.fieldOrder;
}

// Helper function to get embedded field customization
export function getEmbeddedFieldCustomization(
  customization: FormCustomization,
  sectionName: string,
  fieldName: string
): FieldCustomization | undefined {
  const embeddedFieldKey = `${sectionName}.${fieldName}`;
  const fieldCustomization = customization[embeddedFieldKey];
  
  if (isFieldCustomization(fieldCustomization)) {
    return fieldCustomization;
  }
  
  return undefined;
}

// Helper function to get embedded section customization
export function getEmbeddedSectionCustomization(
  customization: FormCustomization,
  sectionName: string
): EmbeddedSectionCustomization | undefined {
  const sectionCustomization = customization[sectionName];
  
  if (isEmbeddedSectionCustomization(sectionCustomization)) {
    return sectionCustomization;
  }
  
  return undefined;
}

// Helper function to get embedded field size relative to section
export function getEmbeddedFieldSize(
  sectionName: string,
  fieldName: string,
  customization: FormCustomization,
  defaultSize: FieldSize = { xs: 12, sm: 6, md: 4 }
): FieldSize {
  const embeddedFieldKey = `${sectionName}.${fieldName}`;
  const fieldCustomization = customization[embeddedFieldKey];
  
  if (isFieldCustomization(fieldCustomization) && fieldCustomization.size) {
    return fieldCustomization.size;
  }
  
  return defaultSize;
}

// Type guard for collection field customization
function isCollectionFieldCustomization(value: unknown): value is CollectionFieldCustomization {
  return typeof value === 'object' && value !== null && ('items' in value || 'customCollectionRenderer' in value || 'onDelete' in value || 'onEdit' in value || 'onCreate' in value);
}

// Helper function to get collection field customization
export function getCollectionFieldCustomization(
  customization: FormCustomization,
  collectionFieldName: string
): CollectionFieldCustomization | undefined {
  const collectionCustomization = customization[collectionFieldName];
  
  if (isCollectionFieldCustomization(collectionCustomization)) {
    return collectionCustomization;
  }
  
  return undefined;
}

// Helper function to get collection item field customization
export function getCollectionItemFieldCustomization(
  customization: FormCustomization,
  collectionFieldName: string,
  itemTypeName: string,
  fieldName: string,
  mode: "edit" | "create" = "edit"
): FieldCustomization | undefined {
  const collectionCustomization = getCollectionFieldCustomization(customization, collectionFieldName);
  
  if (collectionCustomization) {
    // First check mode-specific customizations at collection level (new structure)
    if (mode === "edit" && collectionCustomization.onEdit?.fieldsCustomization && collectionCustomization.onEdit.fieldsCustomization[fieldName]) {
      return collectionCustomization.onEdit.fieldsCustomization[fieldName];
    }
    
    if (mode === "create" && collectionCustomization.onCreate?.fieldsCustomization && collectionCustomization.onCreate.fieldsCustomization[fieldName]) {
      return collectionCustomization.onCreate.fieldsCustomization[fieldName];
    }
    
    // Fallback to legacy items structure
    if (collectionCustomization.items && collectionCustomization.items[itemTypeName]) {
      const itemCustomization = collectionCustomization.items[itemTypeName];
      
      // Check mode-specific customizations in legacy structure
      if (mode === "edit" && itemCustomization.onEdit?.fieldsCustomization && itemCustomization.onEdit.fieldsCustomization[fieldName]) {
        return itemCustomization.onEdit.fieldsCustomization[fieldName];
      }
      
      if (mode === "create" && itemCustomization.onCreate?.fieldsCustomization && itemCustomization.onCreate.fieldsCustomization[fieldName]) {
        return itemCustomization.onCreate.fieldsCustomization[fieldName];
      }
      
      // Fallback to legacy fields format
      if (itemCustomization.fields && itemCustomization.fields[fieldName]) {
        return itemCustomization.fields[fieldName];
      }
      
      // Fallback to the old format for backward compatibility
      if (itemCustomization && 'onChange' in itemCustomization) {
        return itemCustomization as FieldCustomization;
      }
    }
  }
  
  return undefined;
}

// Helper function to get collection item field size
export function getCollectionItemFieldSize(
  collectionFieldName: string,
  itemTypeName: string,
  fieldName: string,
  customization: FormCustomization,
  mode: "edit" | "create" = "edit",
  defaultSize: FieldSize = { xs: 12, sm: 6, md: 4 }
): FieldSize {
  const itemCustomization = getCollectionItemFieldCustomization(customization, collectionFieldName, itemTypeName, fieldName, mode);
  
  if (itemCustomization && itemCustomization.size) {
    return itemCustomization.size;
  }
  
  return defaultSize;
}

// Helper function to check if a field is a collection field
export function isCollectionField(
  customization: FormCustomization,
  fieldName: string
): boolean {
  const fieldCustomization = customization[fieldName];
  return isCollectionFieldCustomization(fieldCustomization);
}

// Helper function to get collection item onSubmit callback
export function getCollectionItemOnSubmit(
  customization: FormCustomization,
  collectionFieldName: string,
  itemTypeName: string,
  mode: "edit" | "create" = "edit"
): CollectionItemModeCustomization['onSubmit'] | undefined {
  const collectionCustomization = getCollectionFieldCustomization(customization, collectionFieldName);
  
  if (collectionCustomization) {
    // Check mode-specific customizations at collection level (new structure)
    if (mode === "edit" && collectionCustomization.onEdit?.onSubmit) {
      return collectionCustomization.onEdit.onSubmit;
    }
    
    if (mode === "create" && collectionCustomization.onCreate?.onSubmit) {
      return collectionCustomization.onCreate.onSubmit;
    }
    
    // Fallback to legacy items structure
    if (collectionCustomization.items && collectionCustomization.items[itemTypeName]) {
      const itemCustomization = collectionCustomization.items[itemTypeName];
      
      if (mode === "edit" && itemCustomization.onEdit?.onSubmit) {
        return itemCustomization.onEdit.onSubmit;
      }
      
      if (mode === "create" && itemCustomization.onCreate?.onSubmit) {
        return itemCustomization.onCreate.onSubmit;
      }
    }
  }
  
  return undefined;
}

// Helper function to get collection onDelete callback
export function getCollectionOnDelete(
  customization: FormCustomization,
  collectionFieldName: string
): CollectionFieldCustomization['onDelete'] | undefined {
  const collectionCustomization = getCollectionFieldCustomization(customization, collectionFieldName);
  return collectionCustomization?.onDelete;
}
