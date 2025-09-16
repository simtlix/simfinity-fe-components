# @simtlix/simfinity-fe-components

A dynamic, schema-driven form management system built with GraphQL, Apollo Client, and Material-UI v7.3.1. This package provides a comprehensive set of React components for building complex entity management interfaces that automatically generate forms from GraphQL schema introspection.

## Features

- **Dynamic Form Generation**: Automatically generates forms from GraphQL schema introspection
- **Entity Management**: Create, edit, view, and manage any entity type
- **Complex Relationships**: Handles nested objects, collections, and foreign key relationships
- **Extensive Customization**: Field-level customization with visibility, validation, and layout control
- **Internationalization**: Built-in i18n support with multi-language capabilities
- **Material-UI Integration**: Beautiful, responsive UI components
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @simtlix/simfinity-fe-components
```

## Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install @apollo/client @emotion/react @emotion/styled @mui/material @mui/icons-material @mui/system @mui/x-data-grid graphql react react-dom
```

## Quick Start

```tsx
import { EntityForm, EntityTable } from '@simtlix/simfinity-fe-components';

function MyApp() {
  return (
    <div>
      <EntityForm
        listField="series"
        action="create"
        onSuccess={() => console.log('Success!')}
      />
      <EntityTable
        listField="series"
        onRowClick={(id) => console.log('Row clicked:', id)}
      />
    </div>
  );
}
```

## Core Components

### EntityForm
The main form component that automatically generates forms from GraphQL schema.

```tsx
<EntityForm
  listField="series"
  action="create" // or "edit" or "view"
  entityId="123" // for edit/view modes
  onSuccess={(data) => console.log('Form submitted:', data)}
  onError={(error) => console.error('Form error:', error)}
/>
```

### EntityTable
A data grid component for displaying and managing entity lists.

```tsx
<EntityTable
  listField="series"
  onRowClick={(id) => navigate(`/series/${id}`)}
  onEdit={(id) => navigate(`/series/${id}/edit`)}
  onDelete={(id) => handleDelete(id)}
/>
```

### FormFieldRenderer
Generic component for rendering any form field type.

```tsx
<FormFieldRenderer
  field={field}
  value={value}
  onChange={handleChange}
  error={error}
/>
```

## Form Customization

The package provides extensive customization capabilities:

```tsx
const formCustomization: FormCustomization = {
  fields: {
    name: {
      visible: true,
      enabled: true,
      size: { xs: 12, md: 6 },
      onChange: (fieldName, value, formData, actions) => {
        // Custom field change logic
        return { success: true };
      }
    }
  },
  embeddedSections: {
    director: {
      visible: true,
      enabled: true,
      size: { xs: 12, md: 6 }
    }
  }
};
```

## Internationalization

Built-in i18n support with customizable labels:

```tsx
import { I18nProvider } from '@simtlix/simfinity-fe-components';

const labels = {
  en: {
    'serie.name': 'Series Name',
    'serie.description': 'Description',
    'form.create': 'Create Series',
    'form.edit': 'Edit Series'
  },
  es: {
    'serie.name': 'Nombre de la Serie',
    'serie.description': 'Descripción',
    'form.create': 'Crear Serie',
    'form.edit': 'Editar Serie'
  }
};

<I18nProvider labels={labels} locale="en">
  <EntityForm listField="series" action="create" />
</I18nProvider>
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```tsx
import type { 
  EntityFormProps, 
  FormCustomization, 
  FormField 
} from '@simtlix/simfinity-fe-components';

const MyComponent: React.FC<EntityFormProps> = (props) => {
  // TypeScript will provide full intellisense
};
```

## Examples

See the `examples/` directory in the main project for comprehensive usage examples including:

- Basic form setup
- Custom field renderers
- Form customization
- Entity-level callbacks
- State machine integration
- i18n configuration

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

For support and questions, please open an issue on our GitHub repository.
