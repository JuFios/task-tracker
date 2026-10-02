import { cn, avatarColor, initials } from '../../lib/utils';

interface AvatarProps {
  name: string;
  className?: string;
}

export function Avatar({ name, className }: AvatarProps) {
  return (
    <span
      title={name}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full',
        'text-xs font-semibold text-white',
        avatarColor(name),
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
