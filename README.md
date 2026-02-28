# @simtlix/simfinity-fe-components

A comprehensive React component library for building dynamic, schema-driven entity management interfaces. Built with `@simtlix/simfinity-js-client` and Material-UI, this package provides powerful components that automatically generate forms and tables from GraphQL schema introspection.

## Features

- **Dynamic Form Generation**: Automatically generates forms from GraphQL schema introspection
- **Advanced Data Tables**: Server-side pagination, sorting, filtering with Material-UI DataGrid
- **Entity Management**: Create, edit, view, and manage any entity type
- **Stepper Mode**: Multi-step forms with customizable steps and navigation
- **Complex Relationships**: Handles nested objects, collections, and foreign key relationships
- **Extensive Customization**: Field-level customization with visibility, validation, and layout control
- **Internationalization**: Built-in i18n support with multi-language capabilities
- **State Machine Integration**: Built-in support for entity state machines
- **Responsive Design**: Beautiful, responsive UI components with Material-UI
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- **Collection Management**: Advanced collection field handling with add/edit/delete operations

## Installation

```bash
npm install @simtlix/simfinity-fe-components @simtlix/simfinity-js-client
```

## Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install @emotion/react @emotion/styled @mui/material @mui/icons-material @mui/system @mui/x-data-grid react react-dom
```

## Quick Start

### Basic Setup

```tsx
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import {
  SimfinityClientProvider,
  I18nProvider,
  EntityForm,
  EntityTable
} from '@simtlix/simfinity-fe-components';

function MyApp() {
  return (
    <SimfinityClientProvider endpoint="http://localhost:3000/graphql">
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <I18nProvider>
          <EntityTable listField="series" />
          <EntityForm listField="series" action="create" />
        </I18nProvider>
      </ThemeProvider>
    </SimfinityClientProvider>
  );
}
```

`SimfinityClientProvider` initializes the `SimfinityClient`, performs a single introspection query against the Simfinity backend, and makes the client available to all child components via React context.

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

## Core Components

### EntityTable

A powerful data grid component with server-side pagination, sorting, and filtering.

```tsx
<EntityTable
  listField="series"                              // GraphQL list field name
  onNavigate={(path) => router.push(path)}        // Optional: custom navigation
  getSearchParams={() => searchParams}            // Optional: custom URL params
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
  listField="series"                         // GraphQL list field name
  action="create"                            // "create" | "edit" | "view"
  entityId="123"                             // Required for edit/view modes
  onNavigate={(path) => router.push(path)}   // Optional: custom navigation
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

Generic component for rendering any form field type. Uses the `SimfinityClient` internally via `useSimfinityClient()` for schema metadata.

```tsx
<FormFieldRenderer
  field={field}                                  // Field definition from schema
  value={value}                                  // Current field value
  onChange={handleChange}                         // Change handler
  error={error}                                  // Validation error
  entityTypeName="Series"                        // Entity type name
  customizationState={customizationState}        // Optional customization
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

## React Hooks

The library provides data-fetching hooks that wrap the `SimfinityClient` imperative API in reactive React hooks:

### useSimfinityClient

Access the `SimfinityClient` instance from context.

```tsx
import { useSimfinityClient } from '@simtlix/simfinity-fe-components';

function MyComponent() {
  const client = useSimfinityClient();
  const typeName = client.getTypeNameForQuery('series'); // "Serie"
  const fields = client.getFieldsOfType('Serie');
}
```

### useFind

Paginated list queries with filter and sort support. Re-fetches when page, size, sort, or filter options change.

```tsx
import { useFind } from '@simtlix/simfinity-fe-components';

const { data, loading, error, totalCount, refetch } = useFind('Serie', {
  page: 0,
  size: 10,
  sort: [{ field: 'name', order: 'ASC' }],
  filters: [{ field: 'name', operator: 'LIKE', value: 'Breaking' }],
});
```

### useEntityById

Fetch a single entity by ID. Pauses automatically when `id` is falsy.

```tsx
import { useEntityById } from '@simtlix/simfinity-fe-components';

const { data, loading, error, refetch } = useEntityById('Serie', entityId, 'id name description');
```

### useFindByParent

Fetch collection items filtered by a parent entity. Supports excluding IDs (for modified/deleted items during editing).

```tsx
import { useFindByParent } from '@simtlix/simfinity-fe-components';

const { data, loading, error, totalCount, refetch } = useFindByParent(
  'Episode',
  'season',       // connection field
  seasonId,       // parent entity ID
  { page: 0, size: 10, excludeIds: ['id1', 'id2'] }
);
```

### useSearch

FK search-as-you-type queries. Pauses when the search term is too short.

```tsx
import { useSearch } from '@simtlix/simfinity-fe-components';

const { data, loading, error } = useSearch('Director', searchTerm, {
  displayField: 'name',
  page: 1,
  size: 10,
  pause: searchTerm.length < 1,
});
```

## Form Customization

The package provides extensive customization capabilities through the `FormCustomization` system:

### Basic Field Customization

```tsx
import { registerFormCustomization } from '@simtlix/simfinity-fe-components';

registerFormCustomization('Episode', 'edit', {
  fieldsCustomization: {
    name: {
      size: { xs: 12, md: 6 },
      order: 1,
    },
    description: {
      visible: (field, value, formData) => !!formData.name,
      order: 2,
    },
    genre: {
      onChange: (field, value, formData, setFieldData) => {
        return { value };
      },
    },
  },
});
```

### Collection Field Customization

```tsx
registerFormCustomization('Serie', 'edit', {
  fieldsCustomization: {
    seasons: {
      onDelete: async (item, setMessage) => {
        return true; // confirm deletion
      },
      onEdit: {
        fieldsCustomization: { number: { enabled: false } },
        onSubmit: async (item, setFieldData, formData) => true,
      },
      onCreate: {
        fieldsCustomization: { number: { order: 1 } },
      },
    },
  },
});
```

### Entity-Level Callbacks

```tsx
registerFormCustomization('Serie', 'create', {
  beforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
    if (!formData.name) {
      actions.setError('Name is required');
      return false;
    }
    return true;
  },
  onSuccess: (result, formData, collectionChanges, transformedData, actions) => {
    return {
      message: 'Entity created successfully!',
      navigateTo: '/entities/series',
    };
  },
  onError: (error, formData, collectionChanges, transformedData, actions) => {
    actions.setError('An error occurred while saving');
  },
});
```

### Stepper Mode

```tsx
registerFormCustomization('Order', 'create', {
  mode: 'stepper',
  steps: [
    {
      stepId: 'basics',
      stepLabel: 'form.step.basics',
      onNext: async (formData, collections, transformed, actions) => {
        return true; // validate before moving to next step
      },
    },
    { stepId: 'details', stepLabel: 'form.step.details' },
    {
      stepId: 'confirm',
      stepLabel: 'form.step.confirm',
      customStepRenderer: (actions, handleFieldChange, handleEmbedded, disabled, formData) => (
        <ConfirmPage />
      ),
    },
  ],
  fieldsCustomization: {
    name: { stepId: 'basics', order: 1 },
    category: { stepId: 'basics', order: 2 },
    description: { stepId: 'details', order: 1 },
  },
});
```

## State Machine Integration

State machines allow you to manage entity state transitions with custom validation and business logic.

```tsx
import { registerEntityStateMachine } from '@simtlix/simfinity-fe-components';

registerEntityStateMachine('season', {
  actions: {
    activate: {
      mutation: 'activate_season',
      from: 'SCHEDULED',
      to: 'ACTIVE',
      onBeforeSubmit: async (formData, collectionChanges, transformedData, actions) => {
        const episodesChanges = collectionChanges.episodes || { added: [], modified: [], deleted: [] };
        if (episodesChanges.added.length === 0) {
          actions.setFormMessage({
            type: 'error',
            message: 'Cannot activate season without episodes',
          });
          return { shouldProceed: false, error: 'Season must have at least one episode' };
        }
        return { shouldProceed: true };
      },
      onSuccess: async (result, formData, collectionChanges, transformedData, actions) => {
        actions.setFormMessage({ type: 'success', message: 'Season activated successfully!' });
      },
      onError: async (error, formData, collectionChanges, transformedData, actions) => {
        actions.setFormMessage({ type: 'error', message: `Failed to activate: ${error.message}` });
      },
    },
    finalize: {
      mutation: 'finalize_season',
      from: 'ACTIVE',
      to: 'FINISHED',
    },
  },
});
```

**State Machine Configuration:**

- `actions`: Object containing all available state transitions
- `mutation`: The mutation name registered in the Simfinity backend for the transition
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

## Internationalization

Built-in i18n support with multiple configuration options:

### Basic i18n Setup

```tsx
import { I18nProvider } from '@simtlix/simfinity-fe-components';

function App() {
  return (
    <SimfinityClientProvider endpoint="http://localhost:3000/graphql">
      <I18nProvider>
        <EntityForm listField="series" action="create" />
      </I18nProvider>
    </SimfinityClientProvider>
  );
}
```

### Custom Labels

```tsx
import { registerFunctionLabels } from '@simtlix/simfinity-fe-components';

registerFunctionLabels('en', {
  'entity.series.single': () => 'Series',
  'entity.series.plural': () => 'Series',
  'entity.series.name': ({ entity }) => `${entity} Name`,
  'form.create': ({ entity }) => `Create ${entity}`,
  'form.edit': ({ entity }) => `Edit ${entity}`,
  'actions.view': ({ entity }) => `View ${entity}`,
  'actions.edit': ({ entity }) => `Edit ${entity}`,
  'actions.delete': ({ entity }) => `Delete ${entity}`,
});
```

Or use JSON labels in `public/i18n/en.json`:

```json
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

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```tsx
import type {
  FormCustomization,
  FormField,
  CollectionFieldState,
  EntityFormCallbacks,
  FormMessage,
  FieldSize,
  MessageType,
  FormCustomizationState,
  FormCustomizationActions,
  ParentFormAccess,
} from '@simtlix/simfinity-fe-components';
```

## Advanced Features

### Collection State Management

```tsx
import { useCollectionState } from '@simtlix/simfinity-fe-components';

function MyComponent() {
  const {
    collectionStates,
    updateCollectionState,
    getCollectionState,
    resetCollectionState,
    getCollectionChanges,
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
import {
  TagsFilterInput,
  BetweenFilterInput,
  DateFilterInput,
  StateMachineFilterInput,
} from '@simtlix/simfinity-fe-components';

// Custom filter inputs are automatically used by EntityTable.
// No additional configuration needed -- they are integrated into the filtering system.
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

## API Reference

### EntityTable Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `listField` | `string` | Yes | GraphQL list field name (e.g., "series") |
| `onNavigate` | `(path: string) => void` | No | Custom navigation function |
| `getSearchParams` | `() => URLSearchParams` | No | Custom URL params getter |
| `onSearchParamsChange` | `(params: URLSearchParams) => void` | No | Custom URL params updater |

### EntityForm Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `listField` | `string` | Yes | GraphQL list field name |
| `action` | `"create" \| "edit" \| "view"` | Yes | Form action mode |
| `entityId` | `string` | No | Required for edit/view modes |
| `onNavigate` | `(path: string) => void` | No | Custom navigation function |

### SimfinityClientProvider Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `endpoint` | `string` | Yes | Simfinity GraphQL endpoint URL |
| `children` | `React.ReactNode` | Yes | Child components |

## Getting Started Guide

1. **Install the package and dependencies:**

```bash
npm install @simtlix/simfinity-fe-components @simtlix/simfinity-js-client
npm install @emotion/react @emotion/styled @mui/material @mui/icons-material @mui/system @mui/x-data-grid react react-dom
```

2. **Wrap your app with providers:**

```tsx
import { SimfinityClientProvider, I18nProvider } from '@simtlix/simfinity-fe-components';
import { ThemeProvider } from '@mui/material/styles';

function App() {
  return (
    <SimfinityClientProvider endpoint="http://localhost:3000/graphql">
      <ThemeProvider theme={theme}>
        <I18nProvider>
          {/* Your app components */}
        </I18nProvider>
      </ThemeProvider>
    </SimfinityClientProvider>
  );
}
```

3. **Start using components:**

```tsx
import { EntityTable, EntityForm } from '@simtlix/simfinity-fe-components';

// Components automatically generate from your GraphQL schema
```

## Migration from URQL

If you are upgrading from a version that used URQL:

1. **Remove URQL dependencies:**

```bash
npm uninstall urql graphql-tag graphql
```

2. **Replace the URQL provider** with `SimfinityClientProvider`:

```diff
- import { Provider as UrqlProvider, createClient } from 'urql';
+ import { SimfinityClientProvider } from '@simtlix/simfinity-fe-components';

- const urqlClient = createClient({ url: 'http://localhost:3000/graphql' });

  function App() {
    return (
-     <UrqlProvider value={urqlClient}>
+     <SimfinityClientProvider endpoint="http://localhost:3000/graphql">
        <ThemeProvider theme={theme}>
          <I18nProvider>
            {/* ... */}
          </I18nProvider>
        </ThemeProvider>
-     </UrqlProvider>
+     </SimfinityClientProvider>
    );
  }
```

3. **Update introspection utility imports.** Functions like `getTypeByName`, `buildSelectionSetForObjectType`, `getListEntityFieldNames`, and `unwrapNamedType` have been removed. Use the equivalent methods on the `SimfinityClient` instance obtained via `useSimfinityClient()`:

| Removed function | Replacement |
|---|---|
| `getElementTypeNameOfListField(schema, field)` | `client.getTypeNameForQuery(field)` |
| `buildSelectionSetForObjectType(schema, type)` | `client.buildSelectionSet(type)` |
| `getListEntityFieldNames(schema)` | `client.getListEntityNames()` |
| `isNumericScalarName(name)` | `client.isNumericScalar(name)` |
| `isBooleanScalarName(name)` | `client.isBooleanScalar(name)` |
| `isDateTimeScalarName(name)` | `client.isDateTimeScalar(name)` |
| `getTypeByName(schema, name)` | `client.getFieldsOfType(name)` |

## Additional Resources

- [Form Customization Guide](./FORM_CUSTOMIZATION_README.md) - Complete guide for customizing forms, fields, collections, and validation
- [Navigation Guide](./STABLE_NAVIGATION_GUIDE.md) - Complete guide for navigation and URL handling
- [TypeScript Definitions](./dist/index.d.ts) - Full TypeScript definitions
- [Examples Repository](https://github.com/simtlix/simfinity-fe) - Complete usage examples

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our [GitHub repository](https://github.com/simtlix/simfinity-fe-components).

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Open an issue on our [GitHub repository](https://github.com/simtlix/simfinity-fe-components/issues)
- Check the [documentation](https://github.com/simtlix/simfinity-fe-components#readme)
- Join our community discussions
