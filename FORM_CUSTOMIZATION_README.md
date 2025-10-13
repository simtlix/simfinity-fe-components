# Form Customization Guide

This guide provides comprehensive documentation for customizing forms in `@simtlix/simfinity-fe-components`. The form customization system allows you to control field visibility, validation, behavior, and layout.

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Stepper Mode](#stepper-mode)
- [Field Customization](#field-customization)
- [Collection Field Customization](#collection-field-customization)
- [Embedded Section Customization](#embedded-section-customization)
- [Entity-Level Callbacks](#entity-level-callbacks)
- [State Machine Integration](#state-machine-integration)
- [Advanced Usage](#advanced-usage)
- [TypeScript Support](#typescript-support)
- [Examples](#examples)

## Overview

The form customization system provides a declarative way to customize forms without modifying the core components. You can:

- Organize forms into multiple steps with **Stepper Mode**
- Control field visibility and enabled state
- Customize field size and layout
- Add custom validation logic
- Implement custom field renderers
- Handle collection operations (add, edit, delete)
- Implement entity-level callbacks (beforeSubmit, onSuccess, onError)

## Core Concepts

### FormCustomization Object

The main configuration object that defines all customizations:

```tsx
type FormCustomization = {
  // Regular field customizations
  fields?: Record<string, FieldCustomization>;
  
  // Collection field customizations
  collectionFields?: Record<string, CollectionFieldCustomization>;
  
  // Embedded section customizations
  embeddedSections?: Record<string, EmbeddedSectionCustomization>;
  
  // Entity-level callbacks
  beforeSubmit?: (formData, collectionChanges, transformedData, actions) => boolean | Promise<boolean>;
  onSuccess?: (result, actions) => EntityFormSuccessResult | void;
  onError?: (error, formData, actions) => void;
};
```

### Registration

Register customizations for specific entity types and modes:

```tsx
import { registerFormCustomization } from '@simtlix/simfinity-fe-components';

registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    name: {
      visible: true,
      enabled: true,
      size: { xs: 12, md: 6 }
    }
  },
  beforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
    // Validation logic
    return true;
  }
});
```

## Stepper Mode

Stepper mode allows you to organize forms into multiple steps for better user experience with complex forms. Each field can be assigned to a specific step.

### Enabling Stepper Mode

```tsx
registerFormCustomization('Series', 'create', {
  mode: 'stepper', // Enable stepper mode
  steps: [
    {
      stepId: 'basic',
      stepLabel: 'Basic Information'
    },
    {
      stepId: 'details',
      stepLabel: 'Details'
    },
    {
      stepId: 'episodes',
      stepLabel: 'Episodes'
    }
  ],
  fieldsCustomization: {
    // Fields must have stepId in stepper mode
    name: {
      stepId: 'basic',
      size: { xs: 12, md: 6 }
    },
    category: {
      stepId: 'basic',
      size: { xs: 12, md: 6 }
    },
    description: {
      stepId: 'details',
      size: { xs: 12 }
    },
    episodes: {
      stepId: 'episodes',
      size: { xs: 12 }
    }
  }
});
```

### Important Rules

**In stepper mode:**
- ✅ All fields (regular, embedded, collection) **MUST** have a `stepId` to be displayed
- ✅ Fields are only shown when their assigned step is active
- ❌ Fields without `stepId` will **NOT** be rendered
- ✅ Navigation buttons (Next/Back) are automatically provided
- ✅ Submit button only appears on the last step

### Step Configuration

```tsx
type FormStep = {
  stepId: string;           // Unique identifier for the step
  stepLabel: string;        // Display name for the step
  customStepRenderer?: () => React.ReactElement; // Optional custom renderer
};
```

### Assigning Fields to Steps

**Regular Fields:**
```tsx
fieldsCustomization: {
  name: {
    stepId: 'basic',  // Assign to 'basic' step
    size: { xs: 12, md: 6 }
  }
}
```

**Collection Fields:**
```tsx
fieldsCustomization: {
  episodes: {
    stepId: 'episodes',  // Collection field in 'episodes' step
    size: { xs: 12 }
  }
}
```

**Embedded Fields:**
```tsx
fieldsCustomization: {
  metadata: {
    stepId: 'details',  // Embedded section in 'details' step
    size: { xs: 12 },
    fieldsCustomization: {
      author: { size: { xs: 12, md: 6 } },
      tags: { size: { xs: 12, md: 6 } }
    }
  }
}
```

### Custom Step Renderer

You can provide a custom renderer for any step:

```tsx
registerFormCustomization('Series', 'create', {
  mode: 'stepper',
  steps: [
    {
      stepId: 'basic',
      stepLabel: 'Basic Information'
    },
    {
      stepId: 'custom',
      stepLabel: 'Custom Step',
      customStepRenderer: () => {
        return (
          <Box>
            <Typography variant="h6">Custom Step Content</Typography>
            <YourCustomComponent />
          </Box>
        );
      }
    }
  ]
});
```

### Variant Modes

The stepper component supports two visual variants:

- **Classic** (default for create mode): Shows completed steps with checkmarks
- **Linear** (default for edit mode): All steps are clickable, active step is highlighted

### Theme Customization

You can customize the stepper appearance through MUI theme. See [STEPPER_THEME_EXAMPLE.md](./STEPPER_THEME_EXAMPLE.md) for complete theme configuration.

### Complete Example

```tsx
registerFormCustomization('Series', 'create', {
  mode: 'stepper',
  steps: [
    {
      stepId: 'basic',
      stepLabel: 'Basic Information'
    },
    {
      stepId: 'content',
      stepLabel: 'Content'
    },
    {
      stepId: 'episodes',
      stepLabel: 'Episodes'
    },
    {
      stepId: 'review',
      stepLabel: 'Review',
      customStepRenderer: () => (
        <Box>
          <Typography variant="h6">Review your series</Typography>
          <SeriesReviewComponent />
        </Box>
      )
    }
  ],
  fieldsCustomization: {
    // Step 1: Basic Information
    name: {
      stepId: 'basic',
      size: { xs: 12, md: 6 },
      onChange: (fieldName, value, formData, setFieldData) => {
        const slug = value.toString().toLowerCase().replace(/\s+/g, '-');
        setFieldData('slug', slug);
        return { value };
      }
    },
    slug: {
      stepId: 'basic',
      size: { xs: 12, md: 6 }
    },
    category: {
      stepId: 'basic',
      size: { xs: 12, md: 6 }
    },
    
    // Step 2: Content
    description: {
      stepId: 'content',
      size: { xs: 12 }
    },
    coverImage: {
      stepId: 'content',
      size: { xs: 12, md: 6 }
    },
    metadata: {
      stepId: 'content',
      size: { xs: 12 },
      fieldsCustomization: {
        author: { size: { xs: 12, md: 6 } },
        tags: { size: { xs: 12, md: 6 } }
      }
    },
    
    // Step 3: Episodes
    episodes: {
      stepId: 'episodes',
      size: { xs: 12 },
      fieldsCustomization: {
        title: { size: { xs: 12, md: 6 } },
        duration: { size: { xs: 12, md: 6 } }
      }
    }
  },
  
  beforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
    // Final validation before submission
    if (!formData.name || !formData.description) {
      actions.setError('Name and description are required');
      return false;
    }
    return true;
  },
  
  onSuccess: (result, actions) => {
    return {
      message: 'Series created successfully!',
      navigateTo: `/series/${result.id}/view`
    };
  }
});
```

## Field Customization

### Basic Field Customization

```tsx
type FieldCustomization = {
  // Field size (responsive)
  size?: { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  
  // Whether field is enabled
  enabled?: boolean | ((fieldName, value, formData) => boolean);
  
  // Whether field is visible
  visible?: boolean | ((fieldName, value, formData) => boolean);
  
  // Display order
  order?: number;
  
  // Change handler
  onChange?: (fieldName, value, formData, setFieldData, setFieldVisible, setFieldEnabled, parentFormAccess?) => {
    value: any;
    error?: string;
  };
  
  // Custom renderer
  customRenderer?: (field, customizationActions, handleFieldChange, disabled) => React.ReactElement;
};
```

### Examples

#### Dynamic Visibility

```tsx
registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    description: {
      visible: (fieldName, value, formData) => {
        // Only show description if name is filled
        return !!formData.name;
      }
    }
  }
});
```

#### Dynamic Enabled State

```tsx
registerFormCustomization('Series', 'edit', {
  fieldsCustomization: {
    title: {
      enabled: (fieldName, value, formData) => {
        // Disable title if series is published
        return formData.status !== 'published';
      }
    }
  }
});
```

#### Custom onChange Handler

```tsx
registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    name: {
      onChange: (fieldName, value, formData, setFieldData, setFieldVisible, setFieldEnabled) => {
        // Auto-generate slug from name
        const slug = value.toString().toLowerCase().replace(/\s+/g, '-');
        setFieldData('slug', slug);
        
        // Show advanced options if name is long
        if (value.toString().length > 50) {
          setFieldVisible('advancedOptions', true);
        }
        
        return { value, error: undefined };
      }
    }
  }
});
```

#### Custom Field Renderer

```tsx
registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    coverImage: {
      customRenderer: (field, customizationActions, handleFieldChange, disabled) => {
        return (
          <ImageUploader
            value={field.value as string}
            onChange={(url) => handleFieldChange(field.name, url)}
            disabled={disabled}
            error={field.error}
          />
        );
      }
    }
  }
});
```

#### Responsive Field Sizing

```tsx
registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    name: {
      size: { xs: 12, md: 6 } // Full width on mobile, half width on desktop
    },
    description: {
      size: { xs: 12 } // Always full width
    },
    category: {
      size: { xs: 12, sm: 6, md: 4 } // Responsive sizing
    }
  }
});
```

## Collection Field Customization

Collection fields represent arrays of nested objects (e.g., episodes in a series).

### CollectionFieldCustomization Type

```tsx
type CollectionFieldCustomization = {
  size?: FieldSize;
  enabled?: boolean | ((fieldName, value, formData) => boolean);
  visible?: boolean | ((fieldName, value, formData) => boolean);
  order?: number;
  
  // Add operation callback
  onAdd?: (fieldName, newItem, actions) => { success: boolean; error?: string } | void;
  
  // Edit operation callback
  onEdit?: (fieldName, item, actions) => { success: boolean; error?: string } | void;
  
  // Delete operation callback
  onDelete?: (fieldName, item, actions) => { success: boolean; error?: string } | void;
  
  // Nested field customizations for items in the collection
  fieldsCustomization?: Record<string, FieldCustomization>;
};
```

### Examples

#### Basic Collection Customization

```tsx
registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    episodes: {
      visible: true,
      enabled: true,
      size: { xs: 12 }
    }
  }
});
```

#### Collection Operation Callbacks

```tsx
registerFormCustomization('Series', 'edit', {
  fieldsCustomization: {
    episodes: {
      onAdd: (fieldName, newItem, actions) => {
        // Validate new episode
        if (!newItem.title) {
          return { success: false, error: 'Episode title is required' };
        }
        
        // Auto-assign episode number
        const existingEpisodes = actions.getFieldValue('episodes') as any[];
        newItem.episodeNumber = existingEpisodes.length + 1;
        
        return { success: true };
      },
      
      onEdit: (fieldName, item, actions) => {
        // Validate edited episode
        if (item.duration && item.duration < 0) {
          return { success: false, error: 'Duration must be positive' };
        }
        return { success: true };
      },
      
      onDelete: (fieldName, item, actions) => {
        // Confirm deletion for published episodes
        if (item.status === 'published') {
          const confirmed = window.confirm('Delete published episode?');
          return { success: confirmed };
        }
        return { success: true };
      }
    }
  }
});
```

#### Nested Field Customization in Collections

```tsx
registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    episodes: {
      fieldsCustomization: {
        // Customize fields within each episode
        title: {
          size: { xs: 12, md: 6 },
          onChange: (fieldName, value, formData, setFieldData, setFieldVisible, setFieldEnabled, parentFormAccess) => {
            // Access parent form data
            const seriesName = parentFormAccess?.getFieldValue('name');
            
            // Generate episode slug
            const slug = `${seriesName}-${value}`.toLowerCase().replace(/\s+/g, '-');
            setFieldData('slug', slug);
            
            return { value };
          }
        },
        duration: {
          size: { xs: 12, md: 6 },
          visible: (fieldName, value, formData) => {
            // Only show duration for video episodes
            return formData.type === 'video';
          }
        }
      }
    }
  }
});
```

## Embedded Section Customization

Embedded sections are nested objects that are displayed inline in the form.

### EmbeddedSectionCustomization Type

```tsx
type EmbeddedSectionCustomization = {
  size?: FieldSize;
  enabled?: boolean | ((fieldName, value, formData) => boolean);
  visible?: boolean | ((fieldName, value, formData) => boolean);
  order?: number;
  
  // Nested field customizations
  fieldsCustomization?: Record<string, FieldCustomization>;
};
```

### Example

```tsx
registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    metadata: {
      visible: true,
      size: { xs: 12 },
      fieldsCustomization: {
        author: {
          size: { xs: 12, md: 6 }
        },
        tags: {
          size: { xs: 12, md: 6 }
        }
      }
    }
  }
});
```

## Entity-Level Callbacks

### beforeSubmit

Called before the form is submitted. Return `false` to prevent submission.

```tsx
type BeforeSubmitCallback = (
  formData: Record<string, unknown>,
  collectionChanges: Record<string, CollectionChanges>,
  transformedData: Record<string, unknown>,
  actions: EntityFormCallbackActions
) => boolean | Promise<boolean>;
```

**Example:**

```tsx
registerFormCustomization('Series', 'create', {
  beforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
    // Validate form data
    if (!formData.name) {
      actions.setError('Name is required');
      return false;
    }
    
    // Check for duplicates
    const exists = await checkSeriesExists(formData.name);
    if (exists) {
      actions.setError('A series with this name already exists');
      return false;
    }
    
    // Show loading state
    actions.setLoading(true);
    
    return true;
  }
});
```

### onSuccess

Called after successful form submission.

```tsx
type OnSuccessCallback = (
  result: any,
  actions: EntityFormCallbackActions
) => EntityFormSuccessResult | void;

type EntityFormSuccessResult = {
  message?: string;
  navigateTo?: string;
  action?: () => void;
};
```

**Example:**

```tsx
registerFormCustomization('Series', 'create', {
  onSuccess: (result, actions) => {
    // Show custom success message
    actions.showMessage('Series created successfully!', 'success');
    
    // Navigate to view page
    return {
      message: 'Series created! Redirecting...',
      navigateTo: `/series/${result.id}/view`
    };
  }
});
```

### onError

Called when form submission fails.

```tsx
type OnErrorCallback = (
  error: Error,
  formData: Record<string, unknown>,
  actions: EntityFormCallbackActions
) => void;
```

**Example:**

```tsx
registerFormCustomization('Series', 'create', {
  onError: (error, formData, actions) => {
    // Log error details
    console.error('Form submission failed:', error, formData);
    
    // Show user-friendly error message
    if (error.message.includes('duplicate')) {
      actions.setError('A series with this name already exists');
    } else {
      actions.setError('Failed to create series. Please try again.');
    }
    
    // Stop loading state
    actions.setLoading(false);
  }
});
```

## State Machine Integration

State machines allow you to manage entity state transitions with custom validation and business logic. This is useful for workflows like activating, publishing, or archiving entities.

### Registering a State Machine

```tsx
import { registerEntityStateMachine } from '@simtlix/simfinity-fe-components';
import { gql } from '@apollo/client';

export function setupSeasonStateMachine() {
  registerEntityStateMachine('season', {
    actions: {
      // Activate action: SCHEDULED → ACTIVE
      activate: {
        mutation: 'activate_season',
        from: 'SCHEDULED',
        to: 'ACTIVE',
        onBeforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
          // Validate business rules before transition
          const episodesChanges = collectionChanges.episodes || { added: [], modified: [], deleted: [] };
          const newEpisodesCount = episodesChanges.added.length;
          
          if (newEpisodesCount === 0) {
            actions.setFormMessage({
              type: 'error',
              message: 'Cannot activate season without episodes'
            });
            return { shouldProceed: false, error: 'Season must have at least one episode' };
          }
          
          return { shouldProceed: true };
        },
        onSuccess: async (result, formData, collectionChanges, transformedData, actions) => {
          console.log('Season activated successfully:', result);
          
          actions.setFormMessage({
            type: 'success',
            message: 'Season activated successfully!'
          });
        },
        onError: async (error, formData, collectionChanges, transformedData, actions) => {
          console.error('Failed to activate season:', error);
          
          actions.setFormMessage({
            type: 'error',
            message: `Failed to activate season: ${error.message}`
          });
        }
      },
      
      // Finalize action: ACTIVE → FINISHED
      finalize: {
        mutation: 'finalize_season',
        from: 'ACTIVE',
        to: 'FINISHED',
        onBeforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
          // Query server for validation
          const GET_EPISODES = gql`
            query GetEpisodes($seasonId: QLValue!, $page: Int!, $size: Int!, $count: Boolean!) {
              episodes(
                season: { terms: { path: "id", operator: EQ, value: $seasonId } }
                pagination: { page: $page, size: $size, count: $count }
              ) {
                id
                date
              }
            }
          `;
          
          const { data } = await apolloClient.query({
            query: GET_EPISODES,
            variables: { 
              seasonId: transformedData.id,
              page: 1,
              size: 1000,
              count: true
            },
            fetchPolicy: 'network-only'
          });
          
          const existingEpisodes = data?.episodes || [];
          const incompleteEpisodes = existingEpisodes.filter(ep => 
            !ep.date || new Date(ep.date) > new Date()
          );
          
          if (incompleteEpisodes.length > 0) {
            actions.setFormMessage({
              type: 'error',
              message: 'Cannot finalize season with incomplete episodes'
            });
            return { shouldProceed: false, error: 'All episodes must be completed' };
          }
          
          return { shouldProceed: true };
        },
        onSuccess: async (result, formData, collectionChanges, transformedData, actions) => {
          actions.setFormMessage({
            type: 'success',
            message: 'Season finalized successfully!'
          });
        },
        onError: async (error, formData, collectionChanges, transformedData, actions) => {
          actions.setFormMessage({
            type: 'error',
            message: `Failed to finalize season: ${error.message}`
          });
        }
      }
    }
  });
}
```

### State Machine Configuration

Each state machine action has the following properties:

- **`mutation`**: GraphQL mutation name for the state transition
- **`from`**: Source state (the current state required to perform this action)
- **`to`**: Destination state (the state after successful transition)
- **`onBeforeSubmit`**: Validation callback executed before the transition
  - Parameters: `formData`, `collectionChanges`, `transformedData`, `actions`
  - Return: `{ shouldProceed: boolean, error?: string }`
  - Return `{ shouldProceed: false }` to cancel the transition
- **`onSuccess`**: Callback executed after successful transition
  - Parameters: `result`, `formData`, `collectionChanges`, `transformedData`, `actions`
- **`onError`**: Callback executed when transition fails
  - Parameters: `error`, `formData`, `collectionChanges`, `transformedData`, `actions`

### Callback Parameters

**Common Parameters:**
- `formData`: Current form field values (all form fields with their current values)
- `collectionChanges`: Object containing changes to collection fields:
  - `added`: Array of newly added items
  - `modified`: Array of modified items
  - `deleted`: Array of deleted items
- `transformedData`: Processed entity data ready for the GraphQL mutation
- `actions`: Object with helper functions:
  - `setFormMessage({ type, message })`: Display a message to the user
  - `setFieldData(fieldName, value)`: Update a field value
  - `getFieldValue(fieldName)`: Get current field value

### Integration with EntityForm

When you register a state machine for an entity type, the EntityForm component automatically:

1. **Shows Actions Button**: Displays an "Actions" button in edit mode
2. **Dynamic Action Menu**: Shows only actions available for the current state
3. **Field Management**: Excludes state machine fields from create forms
4. **Read-only State Fields**: Displays state machine fields as read-only
5. **Form Refresh**: Reloads entity data after successful state transitions

### i18n Labels for State Machines

Define labels for state machine actions and states in your i18n files:

```json
{
  "stateMachine.season.action.activate": "Activate",
  "stateMachine.season.action.finalize": "Finalize",
  "stateMachine.season.state.SCHEDULED": "Scheduled",
  "stateMachine.season.state.ACTIVE": "Active",
  "stateMachine.season.state.FINISHED": "Finished",
  "stateMachine.actions": "Actions"
}
```

**Label Pattern:**
- Actions: `stateMachine.{entityType}.action.{actionName}`
- States: `stateMachine.{entityType}.state.{stateName}`
- Actions button: `stateMachine.actions`

### Example: Publishing Workflow

```tsx
registerEntityStateMachine('article', {
  actions: {
    publish: {
      mutation: 'publish_article',
      from: 'DRAFT',
      to: 'PUBLISHED',
      onBeforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
        // Validate required fields
        if (!formData.title || !formData.content) {
          actions.setFormMessage({
            type: 'error',
            message: 'Title and content are required to publish'
          });
          return { shouldProceed: false };
        }
        
        // Check word count
        const wordCount = (formData.content as string).split(/\s+/).length;
        if (wordCount < 100) {
          actions.setFormMessage({
            type: 'error',
            message: 'Article must have at least 100 words'
          });
          return { shouldProceed: false };
        }
        
        return { shouldProceed: true };
      },
      onSuccess: async (result, formData, collectionChanges, transformedData, actions) => {
        actions.setFormMessage({
          type: 'success',
          message: 'Article published successfully!'
        });
      }
    },
    unpublish: {
      mutation: 'unpublish_article',
      from: 'PUBLISHED',
      to: 'DRAFT',
      onBeforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
        const confirmed = window.confirm('Are you sure you want to unpublish this article?');
        if (!confirmed) {
          return { shouldProceed: false };
        }
        return { shouldProceed: true };
      }
    },
    archive: {
      mutation: 'archive_article',
      from: 'PUBLISHED',
      to: 'ARCHIVED',
      onBeforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
        // Only allow archiving articles older than 1 year
        const publishDate = new Date(formData.publishedAt as string);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        if (publishDate > oneYearAgo) {
          actions.setFormMessage({
            type: 'error',
            message: 'Only articles older than 1 year can be archived'
          });
          return { shouldProceed: false };
        }
        
        return { shouldProceed: true };
      }
    }
  }
});
```

### Best Practices

1. **Validate Before Transition**: Use `onBeforeSubmit` to validate business rules
2. **Provide Clear Messages**: Always inform users why a transition failed
3. **Query Server Data**: Use Apollo Client to fetch fresh data for validation
4. **Handle Errors Gracefully**: Provide helpful error messages in `onError`
5. **Use Collection Changes**: Access `collectionChanges` to validate related data
6. **Return Proper Values**: Return `{ shouldProceed: true/false }` from `onBeforeSubmit`
7. **Define i18n Labels**: Create labels for all actions and states

## Advanced Usage

### Complete Example

Here's a comprehensive example combining multiple customization features:

```tsx
import { registerFormCustomization } from '@simtlix/simfinity-fe-components';

registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    // Basic fields
    name: {
      size: { xs: 12, md: 6 },
      enabled: true,
      visible: true,
      onChange: (fieldName, value, formData, setFieldData) => {
        // Auto-generate slug
        const slug = value.toString().toLowerCase().replace(/\s+/g, '-');
        setFieldData('slug', slug);
        return { value };
      }
    },
    
    slug: {
      size: { xs: 12, md: 6 },
      enabled: (fieldName, value, formData) => {
        // Only allow manual slug editing if name is set
        return !!formData.name;
      }
    },
    
    description: {
      size: { xs: 12 },
      visible: (fieldName, value, formData) => {
        // Only show if category is selected
        return !!formData.category;
      }
    },
    
    // Collection field
    episodes: {
      size: { xs: 12 },
      onAdd: (fieldName, newItem, actions) => {
        // Auto-assign episode number
        const episodes = actions.getFieldValue('episodes') as any[];
        newItem.episodeNumber = episodes.length + 1;
        return { success: true };
      },
      
      onEdit: (fieldName, item, actions) => {
        // Validate duration
        if (item.duration < 0) {
          return { success: false, error: 'Duration must be positive' };
        }
        return { success: true };
      },
      
      fieldsCustomization: {
        title: {
          size: { xs: 12, md: 6 }
        },
        duration: {
          size: { xs: 12, md: 6 },
          visible: (fieldName, value, formData) => formData.type === 'video'
        }
      }
    },
    
    // Embedded section
    metadata: {
      size: { xs: 12 },
      fieldsCustomization: {
        author: { size: { xs: 12, md: 6 } },
        publishDate: { size: { xs: 12, md: 6 } }
      }
    }
  },
  
  // Entity-level callbacks
  beforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
    // Validate
    if (!formData.name) {
      actions.setError('Name is required');
      return false;
    }
    
    // Check duplicates
    const exists = await checkSeriesExists(formData.name);
    if (exists) {
      actions.setError('Series already exists');
      return false;
    }
    
    return true;
  },
  
  onSuccess: (result, actions) => {
    return {
      message: 'Series created successfully!',
      navigateTo: `/series/${result.id}/view`
    };
  },
  
  onError: (error, formData, actions) => {
    console.error('Failed to create series:', error);
    actions.setError('Failed to create series. Please try again.');
  }
});
```

### Mode-Specific Customizations

You can register different customizations for create, edit, and view modes:

```tsx
// Create mode - all fields enabled
registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    name: { enabled: true, size: { xs: 12, md: 6 } },
    status: { enabled: true, size: { xs: 12, md: 6 } }
  }
});

// Edit mode - some fields disabled
registerFormCustomization('Series', 'edit', {
  fieldsCustomization: {
    name: { 
      enabled: (fieldName, value, formData) => formData.status !== 'published',
      size: { xs: 12, md: 6 }
    },
    status: { enabled: true, size: { xs: 12, md: 6 } }
  }
});

// View mode - all fields disabled
registerFormCustomization('Series', 'view', {
  fieldsCustomization: {
    name: { enabled: false, size: { xs: 12, md: 6 } },
    status: { enabled: false, size: { xs: 12, md: 6 } }
  }
});
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```tsx
import type {
  FormCustomization,
  FieldCustomization,
  CollectionFieldCustomization,
  EmbeddedSectionCustomization,
  EntityFormCallbacks,
  EntityFormCallbackActions,
  FormField,
  FieldSize
} from '@simtlix/simfinity-fe-components';

// Type-safe customization
const customization: FormCustomization = {
  fieldsCustomization: {
    name: {
      size: { xs: 12, md: 6 } as FieldSize,
      onChange: (fieldName, value, formData, setFieldData) => {
        // Full type safety
        return { value };
      }
    }
  },
  beforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
    // Actions are fully typed
    actions.setError('Error message');
    actions.setLoading(true);
    return true;
  }
};
```

## Examples

### Conditional Field Display

```tsx
registerFormCustomization('Product', 'create', {
  fieldsCustomization: {
    // Show price only for physical products
    price: {
      visible: (fieldName, value, formData) => formData.type === 'physical'
    },
    
    // Show download URL only for digital products
    downloadUrl: {
      visible: (fieldName, value, formData) => formData.type === 'digital'
    }
  }
});
```

### Field Dependencies

```tsx
registerFormCustomization('Order', 'create', {
  fieldsCustomization: {
    country: {
      onChange: (fieldName, value, formData, setFieldData, setFieldVisible) => {
        // Show state field only for certain countries
        const showState = ['US', 'CA', 'AU'].includes(value as string);
        setFieldVisible('state', showState);
        
        // Clear state if country doesn't have states
        if (!showState) {
          setFieldData('state', null);
        }
        
        return { value };
      }
    }
  }
});
```

### Validation

```tsx
registerFormCustomization('User', 'create', {
  fieldsCustomization: {
    email: {
      onChange: (fieldName, value, formData) => {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value as string)) {
          return {
            value,
            error: 'Please enter a valid email address'
          };
        }
        return { value };
      }
    },
    
    password: {
      onChange: (fieldName, value, formData) => {
        // Validate password strength
        if ((value as string).length < 8) {
          return {
            value,
            error: 'Password must be at least 8 characters'
          };
        }
        return { value };
      }
    }
  }
});
```

### Accessing Parent Form from Collection Items

```tsx
registerFormCustomization('Series', 'create', {
  fieldsCustomization: {
    episodes: {
      fieldsCustomization: {
        title: {
          onChange: (fieldName, value, formData, setFieldData, setFieldVisible, setFieldEnabled, parentFormAccess) => {
            if (parentFormAccess) {
              // Access parent series data
              const seriesName = parentFormAccess.getFieldValue('name');
              const seriesCategory = parentFormAccess.getFieldValue('category');
              
              // Generate full episode title
              const fullTitle = `${seriesName} - ${value}`;
              
              // Update parent form if needed
              parentFormAccess.setFieldValue('lastEpisodeTitle', value);
            }
            
            return { value };
          }
        }
      }
    }
  }
});
```

## Best Practices

1. **Keep customizations focused**: Each customization should handle a specific concern
2. **Use TypeScript**: Take advantage of full type safety
3. **Test thoroughly**: Test all visibility and enabled conditions
4. **Handle errors gracefully**: Provide clear error messages to users
5. **Document complex logic**: Add comments for non-obvious customizations
6. **Use mode-specific customizations**: Register different customizations for create/edit/view modes
7. **Validate early**: Use field-level onChange for immediate feedback
8. **Use beforeSubmit for final validation**: Perform comprehensive validation before submission

## Summary

The form customization system provides powerful and flexible ways to customize forms without modifying core components. By using the declarative API, you can:

- Control field behavior dynamically
- Implement custom validation
- Handle complex field dependencies
- Customize collection operations
- Provide great user experiences

For more examples, see the main [README.md](./README.md) or explore the [examples repository](https://github.com/simtlix/simfinity-fe).
