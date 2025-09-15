# Fixing Material-UI SSR Issues in Next.js

This guide explains how to fix the `internal_mutateStyles` error when using Material-UI with Next.js App Router.

## 🐛 The Problem

The error occurs because Material-UI's styling system tries to run on the server side, but Next.js App Router doesn't allow client-side functions to run during server-side rendering.

## ✅ Solution 1: Proper Client Component Structure

### 1. Create Separate Provider Components

**lib/theme-provider.tsx**
```tsx
'use client';

import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme } from '@mui/material/styles';
import { ReactNode } from 'react';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
```

**lib/apollo-provider.tsx**
```tsx
'use client';

import { ApolloProvider as ApolloClientProvider } from '@apollo/client';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { ReactNode } from 'react';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'https://your-graphql-endpoint.com/graphql',
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

interface ApolloProviderProps {
  children: ReactNode;
}

export function ApolloProvider({ children }: ApolloProviderProps) {
  return (
    <ApolloClientProvider client={client}>
      {children}
    </ApolloClientProvider>
  );
}
```

### 2. Create a Wrapper Component

**components/simfinity-wrapper.tsx**
```tsx
'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/lib/theme-provider';
import { ApolloProvider } from '@/lib/apollo-provider';

interface SimfinityWrapperProps {
  children: ReactNode;
}

export function SimfinityWrapper({ children }: SimfinityWrapperProps) {
  return (
    <ApolloProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </ApolloProvider>
  );
}
```

### 3. Use in Your Page

**app/page.tsx**
```tsx
'use client';

import { Container, Typography, Box, Paper } from '@mui/material';
import { EntityForm, EntityTable } from 'simfinity-fe-components';
import { SimfinityWrapper } from '@/components/simfinity-wrapper';

export default function HomePage() {
  return (
    <SimfinityWrapper>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Simfinity Components - Next.js Example
        </Typography>
        
        <EntityForm
          listField="series"
          action="create"
          onSuccess={(data) => console.log('Form submitted:', data)}
        />
        
        <EntityTable
          listField="series"
          onRowClick={(id) => console.log('Row clicked:', id)}
        />
      </Container>
    </SimfinityWrapper>
  );
}
```

## ✅ Solution 2: Emotion Registry (Advanced)

For better SSR support, use Material-UI's recommended registry pattern:

### 1. Install Additional Dependency
```bash
npm install @emotion/cache
```

### 2. Create Emotion Registry

**lib/registry.tsx**
```tsx
'use client';

import { useServerInsertedHTML } from 'next/navigation';
import { useState } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';

export default function EmotionRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cache] = useState(() => {
    const cache = createCache({ key: 'css' });
    cache.compat = true;
    return cache;
  });

  useServerInsertedHTML(() => {
    return (
      <style
        data-emotion={`${cache.key} ${Object.keys(cache.inserted).join(' ')}`}
        dangerouslySetInnerHTML={{
          __html: Object.values(cache.inserted).join(' '),
        }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
```

### 3. Add to Root Layout

**app/layout.tsx**
```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import EmotionRegistry from '@/lib/registry';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Simfinity Components - Next.js Example',
  description: 'Example Next.js app using simfinity-fe-components',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <EmotionRegistry>
          {children}
        </EmotionRegistry>
      </body>
    </html>
  );
}
```

## 🔧 Next.js Configuration

Make sure your `next.config.js` includes:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['simfinity-fe-components'],
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

module.exports = nextConfig;
```

## 🚀 Key Points

1. **Always use 'use client'** for components that use Material-UI
2. **Separate providers** into their own client components
3. **Wrap Material-UI components** in proper providers
4. **Use Emotion Registry** for better SSR support
5. **Configure Next.js** to transpile your package

## 🐛 Common Issues

### Issue: Still getting SSR errors
**Solution:** Make sure all Material-UI components are wrapped in client components

### Issue: Styles not loading
**Solution:** Ensure CssBaseline is included and Emotion Registry is set up

### Issue: Hydration mismatches
**Solution:** Use the Emotion Registry pattern for consistent server/client rendering

This setup ensures Material-UI works properly with Next.js App Router! 🎉
