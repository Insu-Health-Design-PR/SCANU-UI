import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variants = {
  primary: 'border border-cyan-400/25 bg-cyan-400/12 text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-60',
  secondary: 'border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:opacity-60',
  tertiary: 'border border-slate-400/20 bg-slate-400/5 text-slate-300 transition hover:bg-slate-400/10 disabled:opacity-60',
  danger: 'border border-red-400/25 bg-red-400/12 text-red-100 transition hover:bg-red-400/20 disabled:opacity-60',
};

const sizes = {
  sm: 'rounded-lg px-2 py-1 text-xs font-medium',
  md: 'rounded-xl px-3 py-2 text-sm font-medium',
  lg: 'rounded-2xl px-4 py-3 text-sm font-medium',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    />
  );
}
