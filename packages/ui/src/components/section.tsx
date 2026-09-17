import * as React from 'react';

import { cn } from '@vaqt/ui/lib/utils';

/**
 * Vertical rhythm primitive — replaces ad-hoc `py-6`/`py-12` scattered
 * across page files with one consistent scale so pages stop reading as a
 * flat, unspaced stack.
 */
function Section({
  className,
  spacing = 'default',
  ...props
}: React.ComponentProps<'section'> & {
  spacing?: 'default' | 'tight' | 'loose';
}) {
  return (
    <section
      data-slot="section"
      data-spacing={spacing}
      className={cn(
        'data-[spacing=default]:py-12 data-[spacing=loose]:py-20 data-[spacing=tight]:py-6 sm:data-[spacing=default]:py-16 sm:data-[spacing=loose]:py-24',
        className,
      )}
      {...props}
    />
  );
}

export { Section };
