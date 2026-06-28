'use client';

import { QueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export function useQueryClient() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000, // 10s
            refetchOnWindowFocus: true,
            refetchIntervalInBackground: false,
            retry: 1,
          },
        },
      })
  );
  return client;
}
