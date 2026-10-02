import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        'block w-full appearance-none rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900',
        'shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600',
        'disabled:cursor-not-allowed disabled:bg-slate-50',
        invalid && 'ring-rose-400 focus:ring-rose-500',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
