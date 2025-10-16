# @simtlix/simfinity-fe-components

A comprehensive React component library for building dynamic, schema-driven entity management interfaces. Built with GraphQL, Apollo Client, and Material-UI v7.3.1, this package provides powerful components that automatically generate forms and tables from GraphQL schema introspection.

## ✨ Features

- **🔧 Dynamic Form Generation**: Automatically generates forms from GraphQL schema introspection
- **📊 Advanced Data Tables**: Server-side pagination, sorting, filtering with Material-UI DataGrid
- **🏗️ Entity Management**: Create, edit, view, and manage any entity type
- **📝 Stepper Mode**: Multi-step forms with customizable steps and navigation
- **🔗 Complex Relationships**: Handles nested objects, collections, and foreign key relationships
- **🎨 Extensive Customization**: Field-level customization with visibility, validation, and layout control
- **🌍 Internationalization**: Built-in i18n support with multi-language capabilities
- **🎯 State Machine Integration**: Built-in support for entity state machines
- **📱 Responsive Design**: Beautiful, responsive UI components with Material-UI
- **🔧 TypeScript Support**: Full TypeScript support with comprehensive type definitions
- **🔄 Collection Management**: Advanced collection field handling with add/edit/delete operations

## Installation

```bash
npm install @simtlix/simfinity-fe-components
```

## Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install urql graphql-tag @emotion/react @emotion/styled @mui/material @mui/icons-material @mui/system @mui/x-data-grid graphql react react-dom
```

## 🚀 Quick Start

### Basic Setup

```tsx
import { Provider as UrqlProvider, createClient } from 'urql';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { EntityForm, EntityTable, I18nProvider } from '@simtlix/simfinity-fe-components';

const urqlClient = createClient({
  url: 'http://localhost:3000/graphql',
});

function MyApp() {
  return (
    <UrqlProvider value={urqlClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <I18nProvider>
          <EntityTable listField="series" />
          <EntityForm listField="series" action="create" />
        </I18nProvider>
      </ThemeProvider>
    </UrqlProvider>
  );
}
```

### Next.js Integration

```tsx
// app/page.tsx
'use client';

import { EntityTable } from '@simtlix/simfinity-fe-components';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export default function MyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  const getSearchParams = useCallback(() => {
    return searchParams;
  }, [searchParams]);

  const onSearchParamsChange = useCallback((params: URLSearchParams) => {
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    router.replace(newUrl);
  }, [router]);

  return (
    <EntityTable
      listField="series"
      onNavigate={navigate}
      getSearchParams={getSearchParams}
      onSearchParamsChange={onSearchParamsChange}
    />
  );
}
```

## 🧩 Core Components

### EntityTable
A powerful data grid component with server-side pagination, sorting, and filtering.

```tsx
<EntityTable
  listField="series" // GraphQL list field name
  onNavigate={(path) => router.push(path)} // Optional: custom navigation
  getSearchParams={() => searchParams} // Optional: custom URL params
  onSearchParamsChange={(params) => updateURL(params)} // Optional: custom URL updates
/>
```

**Features:**
- Server-side pagination, sorting, and filtering
- Automatic column generation from GraphQL schema
- Custom column renderers
- State machine field support
- URL state synchronization
- Responsive design

### EntityForm
Automatically generates forms from GraphQL schema with full CRUD operations.

```tsx
<EntityForm
  listField="series" // GraphQL list field name
  action="create" // "create" | "edit" | "view"
  entityId="123" // Required for edit/view modes
  onNavigate={(path) => router.push(path)} // Optional: custom navigation
/>
```

**Features:**
- Automatic form generation from schema
- Field validation and error handling
- Collection field management
- State machine integration
- Form customization support
- Breadcrumb navigation

### CollectionFieldGrid
Advanced collection field management with inline editing.

```tsx
<CollectionFieldGrid
  fieldName="episodes"
  entityTypeName="Series"
  collectionItems={items}
  onCollectionChange={handleChange}
  customizationState={customizationState}
/>
```

**Features:**
- Inline add/edit/delete operations
- Status tracking (added/modified/deleted)
- Custom field renderers
- Validation support
- Responsive grid layout

### FormFieldRenderer
Generic component for rendering any form field type.

```tsx
<FormFieldRenderer
  field={field} // Field definition from schema
  value={value} // Current field value
  onChange={handleChange} // Change handler
  error={error} // Validation error
  schemaData={schemaData} // GraphQL schema
  entityTypeName="Series" // Entity type name
  customizationState={customizationState} // Optional customization
/>
```

**Supported Field Types:**
- Text fields (string, number, email, etc.)
- Boolean fields (checkboxes)
- Date/time fields
- Enum fields (select dropdowns)
- Object fields (nested forms)
- List fields (collections)
- State machine fields

## 🎨 Form Customization

The package provides extensive customization capabilities through the `FormCustomization` system:

### Basic Field Customization

```tsx
import { FormCustomization } from '@simtlix/simfinity-fe-components';

const formCustomization: FormCustomization = {
  fields: {
    name: {
      visible: true,
      enabled: true,
      size: { xs: 12, md: 6 },
      onChange: (fieldName, value, formData, actions) => {
        // Custom field change logic
        if (fieldName === 'name' && value === 'test') {
          actions.setFieldVisible('description', false);
        }
        return { success: true };
      }
    },
    description: {
      visible: true,
      enabled: true,
      size: { xs: 12, md: 6 }
    }
  }
};
```

### Collection Field Customization

```tsx
const collectionCustomization: FormCustomization = {
  collectionFields: {
    episodes: {
      visible: true,
      enabled: true,
      size: { xs: 12 },
      onAdd: (fieldName, newItem, actions) => {
        // Custom add logic
        return { success: true };
      },
      onEdit: (fieldName, item, actions) => {
        // Custom edit logic
        return { success: true };
      },
      onDelete: (fieldName, item, actions) => {
        // Custom delete logic
        return { success: true };
      }
    }
  }
};
```

### Entity-Level Callbacks

```tsx
const entityCallbacks: EntityFormCallbacks = {
  beforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
    // Validate before submission
    if (!formData.name) {
      actions.setError('Name is required');
      return false;
    }
    return true;
  },
  onSuccess: (result, actions) => {
    return {
      message: 'Entity created successfully!',
      navigateTo: '/entities/series'
    };
  },
  onError: (error, formData, actions) => {
    actions.setError('An error occurred while saving');
  }
};
```

### State Machine Integration

State machines allow you to manage entity state transitions with custom validation and business logic.

```tsx
import { registerEntityStateMachine } from '@simtlix/simfinity-fe-components';
import { gql } from 'graphql-tag';

// Register state machine for an entity type
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
        actions.setFormMessage({
          type: 'success',
          message: 'Season activated successfully!'
        });
      },
      onError: async (error, formData, collectionChanges, transformedData, actions) => {
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
          query GetEpisodes($seasonId: QLValue!) {
            episodes(season: { terms: { path: "id", operator: EQ, value: $seasonId } }) {
              id
              date
            }
          }
        `;
        
        const { data } = await apolloClient.query({
          query: GET_EPISODES,
          variables: { seasonId: transformedData.id },
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
```

**State Machine Configuration:**

- `actions`: Object containing all available state transitions
- `mutation`: GraphQL mutation name for the transition
- `from`: Source state
- `to`: Destination state
- `onBeforeSubmit`: Validation callback before transition (return `{ shouldProceed: true/false }`)
- `onSuccess`: Callback after successful transition
- `onError`: Callback on transition failure

**Integration with EntityForm:**

The EntityForm automatically:
1. Shows "Actions" button in edit mode for entities with registered state machines
2. Displays available actions based on current entity state
3. Excludes state machine fields from create forms
4. Shows state machine fields as read-only
5. Reloads entity data after successful transitions

**i18n Labels for State Machines:**

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

## 🌍 Internationalization

Built-in i18n support with multiple configuration options:

### Basic i18n Setup

```tsx
import { I18nProvider } from '@simtlix/simfinity-fe-components';

function App() {
  return (
    <I18nProvider>
      <EntityForm listField="series" action="create" />
    </I18nProvider>
  );
}
```

### Custom Labels

```tsx
// Register function-based labels
import { registerFunctionLabels } from '@simtlix/simfinity-fe-components';

registerFunctionLabels('en', {
  'entity.series.single': () => 'Series',
  'entity.series.plural': () => 'Series',
  'entity.series.name': ({ entity }) => `${entity} Name`,
  'form.create': ({ entity }) => `Create ${entity}`,
  'form.edit': ({ entity }) => `Edit ${entity}`,
  'actions.view': ({ entity }) => `View ${entity}`,
  'actions.edit': ({ entity }) => `Edit ${entity}`,
  'actions.delete': ({ entity }) => `Delete ${entity}`
});

// Or use JSON labels in public/i18n/en.json
{
  "entity.series.single": "Series",
  "entity.series.plural": "Series",
  "entity.series.name": "Series Name",
  "form.create": "Create Series",
  "form.edit": "Edit Series",
  "actions.view": "View",
  "actions.edit": "Edit",
  "actions.delete": "Delete"
}
```

### Column Renderers

```tsx
import { registerColumnRenderer } from '@simtlix/simfinity-fe-components';

// Register custom column renderers
registerColumnRenderer('series.name', ({ value, row }) => (
  <Typography variant="h6" color="primary">
    {value}
  </Typography>
));

registerColumnRenderer('series.status', ({ value, entity }) => {
  const stateKey = `stateMachine.${entity.toLowerCase()}.state.${value}`;
  return <Chip label={resolveLabel([stateKey], { entity }, value)} />;
});
```

## 🔧 TypeScript Support

Full TypeScript support with comprehensive type definitions:

```tsx
import type { 
  EntityFormProps,
  EntityTableProps,
  FormCustomization,
  FormField,
  CollectionFieldState,
  EntityFormCallbacks,
  FormMessage,
  FieldSize,
  MessageType
} from '@simtlix/simfinity-fe-components';

// Component props with full type safety
const MyForm: React.FC<EntityFormProps> = (props) => {
  // TypeScript provides full intellisense and type checking
  return <EntityForm {...props} />;
};

// Customization types
const customization: FormCustomization = {
  fields: {
    name: {
      visible: true,
      enabled: true,
      size: { xs: 12, md: 6 } as FieldSize
    }
  }
};

// Callback types
const callbacks: EntityFormCallbacks = {
  beforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
    // Full type safety for all parameters
    return true;
  }
};
```

## 🛠️ Advanced Features

### Collection State Management

```tsx
import { useCollectionState } from '@simtlix/simfinity-fe-components';

function MyComponent() {
  const {
    collectionStates,
    updateCollectionState,
    getCollectionState,
    resetCollectionState,
    getCollectionChanges
  } = useCollectionState();

  const handleCollectionChange = (fieldName: string, newState: CollectionFieldState) => {
    updateCollectionState(fieldName, newState);
  };

  return (
    <CollectionFieldGrid
      fieldName="episodes"
      entityTypeName="Series"
      collectionItems={getCollectionState('episodes')}
      onCollectionChange={handleCollectionChange}
    />
  );
}
```

### Custom Filter Components

```tsx
import { TagsFilterInput, BetweenFilterInput, DateFilterInput, StateMachineFilterInput } from '@simtlix/simfinity-fe-components';

// Custom filter inputs are automatically used by EntityTable
// No additional configuration needed - they're integrated into the filtering system
```

### Server-Side Operations

```tsx
// EntityTable automatically handles:
// - Server-side pagination
// - Server-side sorting
// - Server-side filtering
// - URL state synchronization
// - Loading states
// - Error handling

<EntityTable
  listField="series"
  // All server operations are handled automatically
  // based on your GraphQL schema
/>
```

## 📚 API Reference

### EntityTable Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `listField` | `string` | ✅ | GraphQL list field name (e.g., "series") |
| `onNavigate` | `(path: string) => void` | ❌ | Custom navigation function |
| `getSearchParams` | `() => URLSearchParams` | ❌ | Custom URL params getter |
| `onSearchParamsChange` | `(params: URLSearchParams) => void` | ❌ | Custom URL params updater |

### EntityForm Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `listField` | `string` | ✅ | GraphQL list field name |
| `action` | `"create" \| "edit" \| "view"` | ✅ | Form action mode |
| `entityId` | `string` | ❌ | Required for edit/view modes |
| `onNavigate` | `(path: string) => void` | ❌ | Custom navigation function |

### FormCustomization Types

```tsx
type FormCustomization = {
  fields?: Record<string, FieldCustomization>;
  collectionFields?: Record<string, CollectionFieldCustomization>;
  embeddedSections?: Record<string, EmbeddedSectionCustomization>;
};

type FieldCustomization = {
  visible?: boolean;
  enabled?: boolean;
  size?: FieldSize;
  onChange?: (fieldName: string, value: unknown, formData: Record<string, unknown>, actions: EntityFormCallbackActions) => { success: boolean } | void;
};
```

## 🚀 Getting Started Guide

1. **Install the package and dependencies:**
   ```bash
   npm install @simtlix/simfinity-fe-components
   npm install urql graphql-tag @emotion/react @emotion/styled @mui/material @mui/icons-material @mui/system @mui/x-data-grid graphql react react-dom
   ```

2. **Set up your URQL Client:**
   ```tsx
   import { createClient } from 'urql';
   
   const client = createClient({
     url: 'your-graphql-endpoint',
   });
   ```

3. **Wrap your app with providers:**
   ```tsx
   import { Provider as UrqlProvider } from 'urql';
   import { ThemeProvider } from '@mui/material/styles';
   import { I18nProvider } from '@simtlix/simfinity-fe-components';
   
   function App() {
     return (
       <UrqlProvider value={client}>
         <ThemeProvider theme={theme}>
           <I18nProvider>
             {/* Your app components */}
           </I18nProvider>
         </ThemeProvider>
       </UrqlProvider>
     );
   }
   ```

4. **Start using components:**
   ```tsx
   import { EntityTable, EntityForm } from '@simtlix/simfinity-fe-components';
   
   // Your components will automatically generate from your GraphQL schema
   ```

## 📖 Additional Resources

- [Form Customization Guide](./FORM_CUSTOMIZATION_README.md) - Complete guide for customizing forms, fields, collections, and validation
- [Navigation Guide](./STABLE_NAVIGATION_GUIDE.md) - Complete guide for navigation and URL handling
- [TypeScript Definitions](./dist/index.d.ts) - Full TypeScript definitions
- [Examples Repository](https://github.com/simtlix/simfinity-fe) - Complete usage examples

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our [GitHub repository](https://github.com/simtlix/simfinity-fe-components).

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- 📧 Open an issue on our [GitHub repository](https://github.com/simtlix/simfinity-fe-components/issues)
- 📚 Check the [documentation](https://github.com/simtlix/simfinity-fe-components#readme)
- 💬 Join our community discussions
