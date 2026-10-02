import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from './button';

interface ConfirmButtonProps extends Omit<ButtonProps, 'children'> {
  children: ReactNode;
  confirmLabel?: string;
}

/** Button that asks for a second click before firing onClick. */
export function ConfirmButton({
  children,
  confirmLabel = 'Click to confirm',
  onClick,
  variant = 'danger',
  ...props
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleClick: ButtonProps['onClick'] = (event) => {
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setConfirming(false);
    onClick?.(event);
  };

  return (
    <Button {...props} variant={variant} onClick={handleClick}>
      {confirming ? confirmLabel : children}
    </Button>
  );
}
