import { useEffect, useCallback, useState, useRef } from 'react';

/**
 * Custom hook for data fetching that avoids infinite loops.
 * Uses a ref to store the fetcher so it doesn't trigger re-renders.
 * Only `deps` control when data is re-fetched.
 * Automatically handles 401 (unauthorized) by redirecting to login.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  const hasFetchedRef = useRef(false);
  const prevDepsRef = useRef<React.DependencyList>(deps);

  // Keep the ref in sync with the latest fetcher via effect
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Check if deps changed and reset fetch flag via effect
  useEffect(() => {
    const depsChanged = prevDepsRef.current.length !== deps.length ||
      prevDepsRef.current.some((d, i) => d !== deps[i]);
    if (depsChanged) {
      hasFetchedRef.current = false;
      prevDepsRef.current = deps;
    }
  }, deps);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Prevent double-fetch in React StrictMode (same deps, same mount)
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetcherRef.current();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error desconocido';
          setError(message);

          // If unauthorized, force redirect to login
          if (message.includes('401') || message.includes('autenticado') || message.includes('No autenticado')) {
            // Clear any stale auth state and reload
            if (typeof window !== 'undefined') {
              document.cookie = 'session_user=; path=/; max-age=0';
              window.location.reload();
            }
          }
        }
      }
      if (!cancelled) {
        setLoading(false);
      }
    }

    load();

    return () => { cancelled = true; };
  }, deps);

  return { data, loading, error, refresh, setData };
}
