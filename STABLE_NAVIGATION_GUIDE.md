# Stable Navigation Implementation Guide

This guide shows how to properly implement navigation with `@simtlix/simfinity-fe-components` to prevent infinite re-renders.

## 🐛 The Root Cause

The infinite re-render issue occurs when:
1. `getSearchParams` function is recreated on every render
2. This causes `searchParams` to be recreated
3. Which triggers effects that depend on `searchParams`
4. Creating an infinite loop

## ✅ Solution: Stable Function References

The key is to ensure that the functions passed to the components are stable and don't change on every render.

## 🚀 Next.js App Router - Correct Implementation

### Option 1: Direct Next.js Hooks (Recommended for Next.js)

If you're using Next.js, you can create a wrapper component that uses Next.js hooks directly:

```tsx
// components/EntityTableWrapper.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { EntityTable } from '@simtlix/simfinity-fe-components';

type EntityTableWrapperProps = {
  listField: string;
};

export default function EntityTableWrapper({ listField }: EntityTableWrapperProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // These are stable because they come from Next.js hooks
  const navigate = (path: string) => router.push(path);
  const getSearchParams = () => searchParams;
  const onSearchParamsChange = (params: URLSearchParams) => {
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    router.replace(newUrl);
  };

  return (
    <EntityTable
      listField={listField}
      onNavigate={navigate}
      getSearchParams={getSearchParams}
      onSearchParamsChange={onSearchParamsChange}
    />
  );
}
```

### Option 2: Stable Callbacks with useCallback

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { EntityTable } from '@simtlix/simfinity-fe-components';
import { useCallback } from 'react';

export default function MyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ CRITICAL: Use useCallback to create stable references
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

### Option 3: Custom Hook (Best Practice)

```tsx
// hooks/useStableNavigation.ts
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function useStableNavigation() {
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

```tsx
// app/page.tsx
'use client';

import { EntityTable } from '@simtlix/simfinity-fe-components';
import { useStableNavigation } from '@/hooks/useStableNavigation';

export default function MyPage() {
  const { navigate, getSearchParams, onSearchParamsChange } = useStableNavigation();

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

## 🚀 Next.js Pages Router

```tsx
import { useRouter } from 'next/router';
import { EntityTable } from '@simtlix/simfinity-fe-components';
import { useCallback } from 'react';

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

## 🔧 Universal Usage (No Framework)

If you don't provide the navigation props, the components will fall back to using `window.location` APIs:

```tsx
// This will work in browser environments without infinite re-renders
<EntityTable listField="series" />
<EntityForm listField="series" action="create" />
```

## 🐛 Common Mistakes to Avoid

### ❌ Wrong - Functions recreated on every render
```tsx
export default function MyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ❌ These functions are recreated on every render
  const navigate = (path: string) => router.push(path);
  const getSearchParams = () => searchParams;
  const onSearchParamsChange = (params: URLSearchParams) => {
    router.replace(`${window.location.pathname}?${params.toString()}`);
  };

  return <EntityTable listField="series" onNavigate={navigate} getSearchParams={getSearchParams} onSearchParamsChange={onSearchParamsChange} />;
}
```

### ❌ Wrong - Dependencies that change frequently
```tsx
const getSearchParams = useCallback(() => {
  return searchParams;
}, [searchParams.toString()]); // ❌ searchParams.toString() changes on every render
```

### ✅ Correct - Stable dependencies
```tsx
const getSearchParams = useCallback(() => {
  return searchParams;
}, [searchParams]); // ✅ searchParams object reference is stable from Next.js hooks
```

## 🔍 Debugging Infinite Re-renders

1. **Check React DevTools** - Look for components re-rendering constantly
2. **Add console.logs** - Log when functions are recreated
3. **Verify useCallback dependencies** - Make sure they're stable
4. **Test without props** - Try using components without navigation props first

## ✅ Benefits

1. **No infinite re-renders** - Components render only when necessary
2. **Better performance** - Reduced unnecessary re-renders
3. **Stable behavior** - Predictable component behavior
4. **Framework flexibility** - Works with any React routing solution

The key is always using `useCallback` with stable dependencies! 🎉
