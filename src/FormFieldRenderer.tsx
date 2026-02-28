import * as React from "react";
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  FormHelperText,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useSimfinityClient } from "./lib/simfinityClient";
import { useI18n } from "./lib/i18n";
import { FormCustomizationState } from "./lib/formCustomization";

export interface FormFieldRendererProps {
  field: {
    name: string;
    type: string;
    isNonNull: boolean;
    isList: boolean;
    extensions?: Record<string, unknown>;
  };
  value: unknown;
  onChange: (fieldName: string, value: unknown) => void;
  onRemove?: (fieldName: string) => void;
  error?: string;
  disabled?: boolean;
  /** @deprecated Kept for backward compat; component uses SimfinityClient instead */
  schemaData?: unknown;
  entityTypeName: string;
  customizationState?: FormCustomizationState;
  parentFieldPath?: string;
  isEmbedded?: boolean;
  hideIdField?: boolean;
}

// Helper: check if field is non-null from type ref shape (used for embedded sub-fields)
function isNonNullField(typeRef: unknown): boolean {
  if (!typeRef || typeof typeRef !== 'object') return false;
  const type = typeRef as { kind?: string };
  return type.kind === 'NON_NULL';
}

export default function FormFieldRenderer({
  field,
  value,
  onChange,
  onRemove,
  error,
  disabled = false,
  schemaData: _schemaData,
  entityTypeName,
  customizationState,
  parentFieldPath = "",
  hideIdField = false
}: FormFieldRendererProps) {
  const client = useSimfinityClient();
  const { resolveLabel } = useI18n();
  
  // Hide ID field if requested
  if (hideIdField && field.name === 'id') {
    return null;
  }

  const fieldPath = parentFieldPath ? `${parentFieldPath}.${field.name}` : field.name;
  const enumValues = client.getEnumValues(field.type);
  const typeFields = client.getFieldsOfType(field.type);
  const isEnum = enumValues.length > 0;
  const isObject = typeFields.length > 0;
  const isRequired = field.isNonNull ?? isNonNullField(field);
  
  // Get field customization
  const fieldCustomization = customizationState?.customization[fieldPath];
  const isVisible = (typeof fieldCustomization === 'object' && fieldCustomization !== null && 'visible' in fieldCustomization) ? (fieldCustomization as any).visible !== false : true;
  const isEnabled = (typeof fieldCustomization === 'object' && fieldCustomization !== null && 'enabled' in fieldCustomization) ? (fieldCustomization as any).enabled !== false : true;
  
  // Check if field is marked as readOnly in schema extensions
  const isReadOnly = field.extensions?.readOnly === true;
  
  if (!isVisible) {
    return null;
  }

  const handleChange = (newValue: unknown) => {
    onChange(fieldPath, newValue);
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove(fieldPath);
    }
  };

  // Handle different field types
  if (field.isList) {
    // List field - render as chips with add/remove functionality
    const listValue = Array.isArray(value) ? value : [];
    
    return (
      <Box sx={{ width: '100%' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {resolveLabel([`${entityTypeName}.${field.name}`], { entity: entityTypeName, field: field.name }, field.name)}
          {isRequired && <span style={{ color: 'error.main' }}> *</span>}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          {listValue.map((item, index) => (
            <Chip
              key={index}
              label={String(item)}
              onDelete={onRemove ? () => {
                const newList = [...listValue];
                newList.splice(index, 1);
                handleChange(newList);
              } : undefined}
              size="small"
            />
          ))}
        </Box>
        <TextField
          size="small"
          placeholder={resolveLabel(["form.addField"], { entity: entityTypeName, field: field.name }, `Add ${field.name}`)}
          onKeyUp={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const input = e.target as HTMLInputElement;
              if (input.value.trim()) {
                handleChange([...listValue, input.value.trim()]);
                input.value = '';
              }
            }
          }}
          disabled={disabled || !isEnabled || isReadOnly}
        />
        {error && <FormHelperText error>{error}</FormHelperText>}
      </Box>
    );
  }

  const ex = field.extensions as { relation?: { embedded?: boolean }; embedded?: boolean } | undefined;
  const isEmbeddedObj = ex?.relation?.embedded === true || ex?.embedded === true;

  // Check if it's an object type (not embedded, not a list)
  if (isObject && !isEmbeddedObj) {
      // Object field - use ObjectFieldSelector
      // For now, we'll render a simple text field since ObjectFieldSelector needs specific props
      // that we don't have access to in this generic context
      return (
        <TextField
          label={resolveLabel([`${entityTypeName}.${field.name}`], { entity: entityTypeName, field: field.name }, field.name)}
          value={value as string || ''}
          onChange={(e) => handleChange(e.target.value)}
          required={isRequired}
          error={!!error}
          helperText={error}
          disabled={disabled || !isEnabled || isReadOnly}
          fullWidth
          size="small"
          placeholder={resolveLabel(["form.selectField"], { entity: entityTypeName, field: field.name }, `Select ${field.name}`)}
        />
      );
    }

  // Check if it's an embedded object
  if (isObject && isEmbeddedObj) {
    // Embedded object - render as a section
    const embeddedFields = typeFields;
    
    return (
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          {resolveLabel([`${entityTypeName}.${field.name}`], { entity: entityTypeName, field: field.name }, field.name)}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
          {embeddedFields.map((embeddedField) => (
            <FormFieldRenderer
              key={embeddedField.name}
              field={{
                name: embeddedField.name,
                type: embeddedField.type?.name ?? 'String',
                isNonNull: embeddedField.type?.kind === 'NON_NULL',
                isList: embeddedField.type?.isList === true,
                extensions: (embeddedField.extensions as Record<string, unknown>) ?? undefined
              }}
              value={(value as Record<string, unknown>)?.[embeddedField.name]}
              onChange={(subFieldName, subValue) => {
                const currentValue = (value as Record<string, unknown>) || {};
                handleChange({
                  ...currentValue,
                  [subFieldName]: subValue
                });
              }}
              error={error}
              disabled={disabled || !isEnabled || isReadOnly}
              entityTypeName={entityTypeName}
              customizationState={customizationState}
              parentFieldPath={fieldPath}
              isEmbedded={true}
              hideIdField={true}
            />
          ))}
        </Box>
      </Box>
    );
  }

  // Handle scalar types
  const actualType = client.getActualScalarType(field.type);
  
  if (actualType === 'Boolean') {
    return (
      <FormControlLabel
        control={
          <Checkbox
            checked={Boolean(value)}
            onChange={(e) => handleChange(e.target.checked)}
            disabled={disabled || !isEnabled || isReadOnly}
          />
        }
        label={resolveLabel([`${entityTypeName}.${field.name}`], { entity: entityTypeName, field: field.name }, field.name)}
      />
    );
  }

  if (actualType === 'Int' || actualType === 'Float') {
    return (
      <TextField
        type="number"
        label={resolveLabel([`${entityTypeName}.${field.name}`], { entity: entityTypeName, field: field.name }, field.name)}
        value={value || ''}
        onChange={(e) => handleChange(e.target.value === '' ? null : Number(e.target.value))}
        required={isRequired}
        error={!!error}
        helperText={error}
        disabled={disabled || !isEnabled || isReadOnly}
        fullWidth
        size="small"
      />
    );
  }

  if (actualType === 'Date') {
    return (
      <TextField
        type="date"
        label={resolveLabel([`${entityTypeName}.${field.name}`], { entity: entityTypeName, field: field.name }, field.name)}
        value={value ? String(value) : ''}
        onChange={(e) => handleChange(e.target.value || null)}
        required={isRequired}
        error={!!error}
        helperText={error}
        disabled={disabled || !isEnabled || isReadOnly}
        fullWidth
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
      />
    );
  }

  // Check if it's an enum
  if (isEnum) {
    
    return (
      <FormControl fullWidth size="small" error={!!error} disabled={disabled || !isEnabled || isReadOnly}>
        <InputLabel>{resolveLabel([`${entityTypeName}.${field.name}`], { entity: entityTypeName, field: field.name }, field.name)}</InputLabel>
        <Select
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          label={resolveLabel([`${entityTypeName}.${field.name}`], { entity: entityTypeName, field: field.name }, field.name)}
        >
          {enumValues.map((enumValue) => (
            <MenuItem key={enumValue} value={enumValue}>
              {resolveLabel([`${entityTypeName}.${field.name}.${enumValue}`], { entity: entityTypeName, field: field.name }, enumValue)}
            </MenuItem>
          ))}
        </Select>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  // Default to text input
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <TextField
        label={resolveLabel([`${entityTypeName}.${field.name}`], { entity: entityTypeName, field: field.name }, field.name)}
        value={value || ''}
        onChange={(e) => handleChange(e.target.value || null)}
        required={isRequired}
        error={!!error}
        helperText={error}
        disabled={disabled || !isEnabled || isReadOnly}
        fullWidth
        size="small"
      />
      {onRemove && (
        <Tooltip title="Remove field">
          <IconButton
            onClick={handleRemove}
            size="small"
            color="error"
            sx={{ mt: 1 }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
