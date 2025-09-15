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
