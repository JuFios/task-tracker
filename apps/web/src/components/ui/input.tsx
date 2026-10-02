import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const BASE_FIELD =
  'block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ' +
  'ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(BASE_FIELD, invalid && 'ring-rose-400 focus:ring-rose-500', className)}
      {...props}
    />
  );
});
