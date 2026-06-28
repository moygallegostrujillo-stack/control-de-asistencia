'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface PollingToastProps<T> {
  data: T | undefined;
  prevCountRef: React.MutableRefObject<number>;
  entityLabel: string;
  getId?: (item: T) => string;
}

/**
 * Muestra un toast cuando el polling detecta nuevos registros.
 * Compara el count actual vs el anterior.
 */
export function PollingToast<T>({
  data,
  prevCountRef,
  entityLabel,
  getId,
}: PollingToastProps<T>) {
  const firstRun = useRef(true);

  useEffect(() => {
    if (!data) return;
    const arr = Array.isArray(data) ? data : [];
    const currentCount = arr.length;

    if (firstRun.current) {
      firstRun.current = false;
      prevCountRef.current = currentCount;
      return;
    }

    if (currentCount > prevCountRef.current) {
      const diff = currentCount - prevCountRef.current;
      toast.success(`${diff} ${diff === 1 ? 'nuevo registro' : 'nuevos registros'} detectado${diff === 1 ? '' : 's'}`, {
        description: entityLabel,
        duration: 4000,
      });
    }
    prevCountRef.current = currentCount;
  }, [data, prevCountRef, entityLabel, getId]);

  return null;
}
