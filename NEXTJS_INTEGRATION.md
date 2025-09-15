# Next.js Integration Guide

This guide shows you how to use `simfinity-fe-components` with Next.js projects.

## 🚀 Method 1: Local Package Installation (Recommended)

### Step 1: Create the Package
```bash
# In the simfinity-fe-components directory
npm pack
# This creates: simfinity-fe-components-1.0.0.tgz
```

### Step 2: Install in Your Next.js Project
```bash
# In your Next.js project directory
npm install /path/to/simfinity-fe-components-1.0.0.tgz

# Or if the .tgz file is in the same directory
npm install ./simfinity-fe-components-1.0.0.tgz
```

### Step 3: Install Peer Dependencies
```bash
npm install @apollo/client @emotion/react @emotion/styled @mui/material @mui/icons-material @mui/system @mui/x-data-grid graphql
```

## 🔧 Method 2: Git Repository Installation

### Install directly from GitHub
```bash
npm install git+https://github.com/simtlix/simfinity-fe-components.git
```

## 📁 Method 3: Local Development Setup

### Option A: Copy dist folder
```bash
# Copy the dist folder to your Next.js project
cp -r /path/to/simfinity-fe-components/dist ./packages/simfinity-fe-components/

# Then import directly
import { EntityForm } from './packages/simfinity-fe-components/index.esm.js';
```

### Option B: Symlink (Better for development)
```bash
# Create a symlink in your Next.js project
ln -s /path/to/simfinity-fe-components ./packages/simfinity-fe-components

# Install dependencies in the symlinked package
cd packages/simfinity-fe-components && npm install
```

## 🎯 Next.js App Router Setup

### 1. Create a Client Component Wrapper
```tsx
// components/SimfinityWrapper.tsx
'use client';

import { ApolloProvider, ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { EntityForm, EntityTable } from 'simfinity-fe-components';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'https://your-graphql-endpoint.com/graphql',
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

const theme = createTheme({
  // Your MUI theme configuration
});

export function SimfinityWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={client}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ApolloProvider>
  );
}
```

### 2. Use in Your App
```tsx
// app/page.tsx
import { SimfinityWrapper } from '@/components/SimfinityWrapper';
import { EntityForm, EntityTable } from 'simfinity-fe-components';

export default function HomePage() {
  return (
    <SimfinityWrapper>
      <div className="container mx-auto p-4">
        <h1>My Next.js App with Simfinity Components</h1>
        
        <div className="mb-8">
          <h2>Entity Form</h2>
          <EntityForm
            listField="series"
            action="create"
            onSuccess={(data) => console.log('Form submitted:', data)}
          />
        </div>
        
        <div>
          <h2>Entity Table</h2>
          <EntityTable
            listField="series"
            onRowClick={(id) => console.log('Row clicked:', id)}
          />
        </div>
      </div>
    </SimfinityWrapper>
  );
}
```

## 🎯 Next.js Pages Router Setup

### 1. Setup Apollo Client
```tsx
// lib/apollo-client.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'https://your-graphql-endpoint.com/graphql',
});

export const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});
```

### 2. Setup MUI Theme
```tsx
// lib/theme.ts
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  // Your theme configuration
});
```

### 3. Use in Pages
```tsx
// pages/index.tsx
import { ApolloProvider } from '@apollo/client';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { client } from '@/lib/apollo-client';
import { theme } from '@/lib/theme';
import { EntityForm, EntityTable } from 'simfinity-fe-components';

export default function HomePage() {
  return (
    <ApolloProvider client={client}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="container mx-auto p-4">
          <h1>My Next.js App with Simfinity Components</h1>
          
          <EntityForm
            listField="series"
            action="create"
            onSuccess={(data) => console.log('Form submitted:', data)}
          />
          
          <EntityTable
            listField="series"
            onRowClick={(id) => console.log('Row clicked:', id)}
          />
        </div>
      </ThemeProvider>
    </ApolloProvider>
  );
}
```

## 🔧 Next.js Configuration

### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['simfinity-fe-components'],
  experimental: {
    esmExternals: 'loose', // Helps with ESM packages
  },
  webpack: (config) => {
    // Handle ESM modules
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

module.exports = nextConfig;
```

## 🐛 Troubleshooting

### Issue: Module not found
**Solution:** Make sure to add `transpilePackages` in next.config.js

### Issue: ESM/CommonJS conflicts
**Solution:** Use the `esmExternals: 'loose'` option

### Issue: Styling not working
**Solution:** Make sure to wrap with MUI ThemeProvider and CssBaseline

### Issue: Apollo Client errors
**Solution:** Ensure ApolloProvider wraps your components

## 🚀 Development Workflow

### When you make changes to simfinity-fe-components:
1. Make your changes
2. Run `npm run build`
3. Run `npm pack` to create new .tgz
4. In your Next.js project: `npm install ./simfinity-fe-components-1.0.0.tgz`
5. Restart your Next.js dev server

## 📦 Publishing to NPM

When ready for production:
```bash
npm publish
```

Then install normally:
```bash
npm install simfinity-fe-components
```
