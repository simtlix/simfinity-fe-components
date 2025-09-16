# Fix for Infinite Re-render Issue

This guide explains how to fix the infinite re-render issue that occurs when using `@simtlix/simfinity-fe-components` with Next.js.

## 🐛 The Problem

The infinite re-render issue occurs when:
1. The `getSearchParams` function is recreated on every render
2. This causes `searchParams` to be recreated
3. Which triggers the `updateURL` function
4. Which causes a re-render
5. Creating an infinite loop

## ✅ The Solution

### 1. Fixed in the Component Library

The component library now uses a stable reference to `searchParams` to prevent infinite re-renders:

```typescript
// Create a stable reference to searchParams to prevent infinite re-renders
const searchParamsRef = React.useRef(searchParams);
const [currentSearchParams, setCurrentSearchParams] = React.useState(searchParams);

// Update currentSearchParams only when searchParams actually changes
React.useEffect(() => {
  const searchParamsString = searchParams.toString();
  const currentString = searchParamsRef.current.toString();
  
  if (searchParamsString !== currentString) {
    searchParamsRef.current = searchParams;
    setCurrentSearchParams(searchParams);
  }
}, [searchParams]);
```

### 2. Proper Implementation in Parent Component

The key is to create stable references to the navigation functions. Here's how to do it properly:

## 🚀 Next.js App Router - Correct Implementation

### ❌ Wrong Way (Causes Infinite Re-renders)
```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { EntityTable } from '@simtlix/simfinity-fe-components';

export default function MyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ❌ These functions are recreated on every render
  const navigate = (path: string) => router.push(path);
  const getSearchParams = () => searchParams;
  const onSearchParamsChange = (params: URLSearchParams) => {
    router.replace(`${window.location.pathname}?${params.toString()}`);
  };

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

### ✅ Correct Way (Prevents Infinite Re-renders)
```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { EntityTable } from '@simtlix/simfinity-fe-components';
import { useCallback, useMemo } from 'react';

export default function MyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ Stable navigation function
  const navigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  // ✅ Stable search params function
  const getSearchParams = useCallback(() => {
    return searchParams;
  }, [searchParams]);

  // ✅ Stable URL change function
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

## 🚀 Even Better - Custom Hook

Create a custom hook to encapsulate the navigation logic:

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

### Usage with Custom Hook
```tsx
'use client';

import { EntityTable } from '@simtlix/simfinity-fe-components';
import { useNavigation } from '@/hooks/useNavigation';

export default function MyPage() {
  const { navigate, getSearchParams, onSearchParamsChange } = useNavigation();

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

## 🚀 Next.js Pages Router - Correct Implementation

```tsx
import { useRouter } from 'next/router';
import { EntityTable } from '@simtlix/simfinity-fe-components';
import { useCallback, useMemo } from 'react';

export default function MyPage() {
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

## 🔧 Key Points

1. **Always use `useCallback`** for navigation functions
2. **Stable dependencies** - Don't recreate functions on every render
3. **Memoize search params** - Use `useCallback` for `getSearchParams`
4. **Stable URL changes** - Use `useCallback` for `onSearchParamsChange`

## 🐛 Debugging Infinite Re-renders

If you're still experiencing infinite re-renders:

1. **Check React DevTools** - Look for components re-rendering constantly
2. **Add console.logs** - Log when functions are recreated
3. **Check dependencies** - Ensure `useCallback` dependencies are stable
4. **Verify URL changes** - Make sure URL changes aren't causing re-renders

## ✅ Benefits of the Fix

1. **No more infinite re-renders** - Components render only when necessary
2. **Better performance** - Reduced unnecessary re-renders
3. **Stable behavior** - Predictable component behavior
4. **Better UX** - No more page freezing or excessive server requests

The infinite re-render issue is now fixed both in the component library and in the proper implementation patterns! 🎉
