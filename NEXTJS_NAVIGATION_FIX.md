# Next.js Navigation Fix for Simfinity Components

This guide explains how to fix the navigation and URL handling issues when using `@simtlix/simfinity-fe-components` with Next.js.

## 🐛 The Problem

The components were using direct `window.location` APIs which cause issues in:
- Server-side rendering (SSR)
- Next.js App Router
- Other React frameworks
- When components are used in different environments

## ✅ The Solution

The components now accept optional navigation and URL handling props that allow you to provide your own implementation.

## 🔧 Updated Component Props

### EntityTable Props
```typescript
type EntityTableProps = {
  listField: string;
  // Optional navigation and URL handling
  onNavigate?: (path: string) => void;
  getSearchParams?: () => URLSearchParams;
  onSearchParamsChange?: (params: URLSearchParams) => void;
};
```

### EntityForm Props
```typescript
type EntityFormProps = {
  listField: string;
  entityId?: string;
  action: "create" | "edit" | "view";
  // Optional navigation handling
  onNavigate?: (path: string) => void;
};
```

## 🚀 Next.js App Router Implementation

### 1. Create Navigation Hook
```tsx
// hooks/useNavigation.ts
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function useNavigation() {
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

  return {
    navigate,
    getSearchParams,
    onSearchParamsChange,
  };
}
```

### 2. Use in Your Components
```tsx
// app/entities/page.tsx
'use client';

import { EntityTable, EntityForm } from '@simtlix/simfinity-fe-components';
import { useNavigation } from '@/hooks/useNavigation';

export default function EntitiesPage() {
  const { navigate, getSearchParams, onSearchParamsChange } = useNavigation();

  return (
    <div>
      <EntityTable
        listField="series"
        onNavigate={navigate}
        getSearchParams={getSearchParams}
        onSearchParamsChange={onSearchParamsChange}
      />
    </div>
  );
}
```

### 3. Form with Navigation
```tsx
// app/entities/create/page.tsx
'use client';

import { EntityForm } from '@simtlix/simfinity-fe-components';
import { useNavigation } from '@/hooks/useNavigation';

export default function CreateEntityPage() {
  const { navigate } = useNavigation();

  return (
    <EntityForm
      listField="series"
      action="create"
      onNavigate={navigate}
    />
  );
}
```

## 🚀 Next.js Pages Router Implementation

### 1. Create Navigation Hook
```tsx
// hooks/useNavigation.ts
import { useRouter } from 'next/router';
import { useCallback } from 'react';

export function useNavigation() {
  const router = useRouter();

  const navigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  const getSearchParams = useCallback(() => {
    return new URLSearchParams(router.asPath.split('?')[1] || '');
  }, [router.asPath]);

  const onSearchParamsChange = useCallback((params: URLSearchParams) => {
    const newUrl = `${router.pathname}?${params.toString()}`;
    router.replace(newUrl);
  }, [router]);

  return {
    navigate,
    getSearchParams,
    onSearchParamsChange,
  };
}
```

### 2. Use in Your Components
```tsx
// pages/entities/index.tsx
import { EntityTable } from '@simtlix/simfinity-fe-components';
import { useNavigation } from '@/hooks/useNavigation';

export default function EntitiesPage() {
  const { navigate, getSearchParams, onSearchParamsChange } = useNavigation();

  return (
    <div>
      <EntityTable
        listField="series"
        onNavigate={navigate}
        getSearchParams={getSearchParams}
        onSearchParamsChange={onSearchParamsChange}
      />
    </div>
  );
}
```

## 🔧 React Router Implementation

### 1. Create Navigation Hook
```tsx
// hooks/useNavigation.ts
import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';

export function useNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const getSearchParams = useCallback(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);

  const onSearchParamsChange = useCallback((params: URLSearchParams) => {
    const newUrl = `${location.pathname}?${params.toString()}`;
    navigate(newUrl, { replace: true });
  }, [navigate, location.pathname]);

  return {
    navigate: handleNavigate,
    getSearchParams,
    onSearchParamsChange,
  };
}
```

## 🎯 Universal Usage (No Framework)

If you don't provide the navigation props, the components will fall back to using `window.location` APIs:

```tsx
// This will work in browser environments
<EntityTable listField="series" />
<EntityForm listField="series" action="create" />
```

## 🔄 Migration Guide

### Before (Causing Issues)
```tsx
// This would cause SSR issues
<EntityTable listField="series" />
<EntityForm listField="series" action="create" />
```

### After (Fixed)
```tsx
// Next.js App Router
const { navigate, getSearchParams, onSearchParamsChange } = useNavigation();

<EntityTable
  listField="series"
  onNavigate={navigate}
  getSearchParams={getSearchParams}
  onSearchParamsChange={onSearchParamsChange}
/>

<EntityForm
  listField="series"
  action="create"
  onNavigate={navigate}
/>
```

## ✅ Benefits

1. **SSR Compatible** - No more server-side rendering issues
2. **Framework Agnostic** - Works with any routing solution
3. **Backward Compatible** - Still works without props in browser environments
4. **Type Safe** - Full TypeScript support
5. **Flexible** - You control the navigation behavior

## 🐛 Troubleshooting

### Issue: Components still using window.location
**Solution:** Make sure you're passing the navigation props

### Issue: URL not updating
**Solution:** Check that `onSearchParamsChange` is properly implemented

### Issue: Navigation not working
**Solution:** Verify that `onNavigate` is calling your router correctly

This fix ensures your components work properly in all React environments! 🎉
