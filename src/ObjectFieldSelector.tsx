import * as React from "react";
import { useQuery, gql } from "@apollo/client";
import {
  Box,
  Chip,
  TextField,
  Popper,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  CircularProgress,
  FormControl,
  FormHelperText,
} from "@mui/material";
import { useI18n } from "./lib/i18n";

type ObjectFieldSelectorProps = {
  label: string;
  value: string | null | { id: string; [key: string]: unknown };
  onChange: (value: string | null | { id: string; [key: string]: unknown }) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  objectTypeName: string;
  descriptionField: string;
  descriptionFieldType: string; // The type of the description field (e.g., "String", "Int", "Float")
  listQueryName: string; // The query name for listing objects (e.g., "directors")
  singleQueryName: string; // The query name for getting a single object (e.g., "director")
};



export default function ObjectFieldSelector({
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  objectTypeName,
  descriptionField,
  descriptionFieldType,
  listQueryName,
  singleQueryName,
}: ObjectFieldSelectorProps) {
  const { resolveLabel } = useI18n();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedObject, setSelectedObject] = React.useState<{ id: string; [key: string]: unknown } | null>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);

  // Initialize selectedObject when value prop changes
  React.useEffect(() => {
    if (value && !selectedObject) {
      // If we have a value but no selectedObject, we need to fetch the object data
      if (typeof value === 'string') {
        // If value is a string (ID), create a minimal object
        setSelectedObject({
          id: value,
          [descriptionField]: value // Temporary description until we fetch the real data
        });
      } else if (typeof value === 'object' && value !== null && 'id' in value) {
        // If value is already an object, use it directly
        setSelectedObject(value);
      }
    } else if (!value && selectedObject) {
      // If value is cleared, clear selectedObject
      setSelectedObject(null);
    }
  }, [value, selectedObject, descriptionField]);

  // Helper function to cast search term to proper type
  const castSearchTerm = React.useCallback((term: string, fieldType: string) => {
    if (!term) return term;
    
    // Handle Simfinity validated scalars (e.g., "SeasonNumber_Int" -> "Int")
    const actualType = fieldType.includes('_') ? fieldType.split('_').pop() : fieldType;
    
    switch (actualType?.toLowerCase()) {
      case 'int':
      case 'integer':
        const intValue = parseInt(term, 10);
        return isNaN(intValue) ? term : intValue;
      case 'float':
      case 'double':
        const floatValue = parseFloat(term);
        return isNaN(floatValue) ? term : floatValue;
      case 'boolean':
        if (term.toLowerCase() === 'true') return true;
        if (term.toLowerCase() === 'false') return false;
        return term;
      case 'string':
      default:
        return term;
    }
  }, []);

  // Generate dynamic search query using the provided list query name
  const generateSearchQuery = React.useMemo(() => {
    if (!listQueryName || !descriptionField) return null;
    
    // Determine the operator based on the field type
    const isStringType = descriptionFieldType.toLowerCase() === 'string';
    const operator = isStringType ? 'LIKE' : 'EQ';
    
    // Create the query string dynamically using the Simfinity pattern with pagination
    const queryString = `
      query Search${listQueryName.charAt(0).toUpperCase() + listQueryName.slice(1)}($page: Int!, $size: Int!, $count: Boolean!, $searchTerm: QLValue!) {
        ${listQueryName}(
          pagination: {page: $page, size: $size, count: $count}
          ${descriptionField}: {operator: ${operator}, value: $searchTerm}
        ) {
          id
          ${descriptionField}
          __typename
        }
      }
    `;
    
    try {
      // Use gql with the query string
      return gql(queryString);
    } catch (error) {
      console.error('Error generating search query:', error);
      return null;
    }
  }, [listQueryName, descriptionField, descriptionFieldType]);

  // Fetch search results when search term is 1+ characters
  const { data: searchData, loading: searchLoading, error: searchError } = useQuery(generateSearchQuery!, {
    variables: {
      page: 1,
      size: 10,
      count: false,
      searchTerm: castSearchTerm(searchTerm, descriptionFieldType),
    },
    skip: searchTerm.length < 1 || !isOpen || !generateSearchQuery,
  });

  // Log any search errors
  React.useEffect(() => {
    if (searchError) {
      console.error('Search query error:', searchError);
    }
  }, [searchError]);

  // Generate dynamic query for selected object data using the provided single query name
  const generateSelectedObjectQuery = React.useMemo(() => {
    if (!singleQueryName || !descriptionField) return null;
    
    const queryString = `
      query Get${singleQueryName.charAt(0).toUpperCase() + singleQueryName.slice(1)}($id: ID!) {
        ${singleQueryName}(id: $id) {
          id
          ${descriptionField}
        }
      }
    `;
    
    try {
      return gql(queryString);
    } catch (error) {
      console.error('Error generating selected object query:', error);
      return null;
    }
  }, [singleQueryName, descriptionField]);

  // Load selected object data when value changes
  const { data: selectedData, error: selectedError } = useQuery(
    generateSelectedObjectQuery!,
    {
      variables: { id: typeof value === 'string' ? value : (value as { id: string; [key: string]: unknown })?.id },
      skip: !value || !generateSelectedObjectQuery,
    }
  );

  // Log any selected object errors
  React.useEffect(() => {
    if (selectedError) {
      console.error('Selected object query error:', selectedError);
    }
  }, [selectedError]);

  // Update selected object when data is loaded
  React.useEffect(() => {
    if (selectedData && value) {
      const object = selectedData[singleQueryName];
      if (object) {
        setSelectedObject({
          id: object.id,
          [descriptionField]: object[descriptionField],
        });
      }
    } else {
      setSelectedObject(null);
    }
  }, [selectedData, value, singleQueryName, descriptionField]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setSearchTerm(newValue);
    
    if (newValue.length >= 1) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelectObject = (object: { id: string; [key: string]: unknown }) => {
    setSelectedObject(object);
    onChange(object);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleRemoveObject = () => {
    setSelectedObject(null);
    onChange(null);
  };

  const handleInputFocus = () => {
    if (searchTerm.length >= 1) {
      setIsOpen(true);
    }
  };

  const handleInputBlur = () => {
    // Delay closing to allow for click events on suggestions
    setTimeout(() => setIsOpen(false), 200);
  };

  // Get search results from the dynamic query response
  const getSearchResults = () => {
    if (!searchData || !listQueryName) return [];
    
    // Use the list query name directly for the response key
    return searchData[listQueryName] || [];
  };

  const searchResults = getSearchResults();

  return (
    <Box>
      <FormControl fullWidth error={!!error || (required && !selectedObject)} required={required}>
        <TextField
          ref={anchorRef}
          fullWidth
          label={label}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          disabled={disabled}
          placeholder={selectedObject ? 
            resolveLabel(["form.searchAnother"], { entity: objectTypeName }, "Search for another...") : 
            resolveLabel(["form.searchObject"], { entity: objectTypeName }, "Search {entity}...").replace("{entity}", objectTypeName)
          }
          variant="outlined"
        />
        
        {/* Selected object chip */}
        {selectedObject && (
          <Box sx={{ mt: 1 }}>
            <Chip
              label={selectedObject[descriptionField] as string}
              onDelete={disabled ? undefined : handleRemoveObject}
              variant="outlined"
              color="primary"
            />
          </Box>
        )}
        
        {/* Error message */}
        {(error || (required && !selectedObject)) && (
          <FormHelperText>
            {error || resolveLabel(["form.required"], { entity: objectTypeName }, "This field is required")}
          </FormHelperText>
        )}
      </FormControl>

      {/* Search results popup */}
      <Popper
        open={isOpen && searchResults.length > 0}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        style={{ zIndex: 1300, width: anchorRef.current?.offsetWidth }}
      >
        <Paper elevation={3} sx={{ maxHeight: 200, overflow: 'auto' }}>
          {searchLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : (
            <List dense>
              {searchResults.map((object: { id: string; [key: string]: string }) => (
                <ListItem key={object.id} disablePadding>
                  <ListItemButton
                    onClick={() => handleSelectObject(object)}
                    selected={selectedObject?.id === object.id}
                  >
                    <ListItemText
                      primary={object[descriptionField] || object.id}
                      secondary={`ID: ${object.id}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Popper>
    </Box>
  );
}
