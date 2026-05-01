import type { ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { cn } from '@/lib/cn';

interface CollapsibleControlsProps {
  open: boolean;
  onToggle: () => void;
  status: string;
  children: ReactNode;
}

export function CollapsibleControls({ open, onToggle, status, children }: CollapsibleControlsProps) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="inline-flex min-w-28 items-center justify-center gap-2"
          aria-expanded={open}
          onClick={onToggle}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Controls
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open ? 'rotate-180' : '')} />
        </Button>
        <div className="min-w-0 flex-1 truncate text-xs text-slate-500">{status}</div>
      </div>
      {open ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          {children}
          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-400">{status}</div>
        </div>
      ) : null}
    </div>
  );
}
