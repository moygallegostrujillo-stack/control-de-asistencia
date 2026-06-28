'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FreshnessIndicatorProps {
  lastUpdated: Date | null;
  isFetching: boolean;
  onRefresh: () => void;
  className?: string;
}

export function FreshnessIndicator({
  lastUpdated,
  isFetching,
  onRefresh,
  className,
}: FreshnessIndicatorProps) {
  const [, force] = useState(0);

  // Re-render every 5s para actualizar el "hace Xs"
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  if (!lastUpdated) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isFetching}
        className={cn('gap-2', className)}
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
        Cargando...
      </Button>
    );
  }

  const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
  let label: string;
  let color: string;

  if (secs < 30) {
    label = `Hace ${secs}s`;
    color = 'text-emerald-600 bg-emerald-50 border-emerald-200';
  } else if (secs < 60) {
    label = `Hace ${secs}s`;
    color = 'text-amber-600 bg-amber-50 border-amber-200';
  } else if (secs < 3600) {
    label = `Hace ${Math.floor(secs / 60)}min`;
    color = 'text-zinc-600 bg-zinc-50 border-zinc-200';
  } else {
    label = `Hace ${Math.floor(secs / 3600)}h`;
    color = 'text-zinc-500 bg-zinc-50 border-zinc-200';
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
          color
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isFetching}
        className="gap-2"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
        <span className="hidden sm:inline">Actualizar</span>
      </Button>
    </div>
  );
}
