import * as React from 'react';

import { cn } from '@vaqt/ui/lib/utils';

/**
 * The one place page max-width + side gutter is defined — every page wraps
 * its content in this instead of repeating `mx-auto w-full max-w-5xl px-4`.
 * `size="wide"` is for content-dense pages (request lists, dashboards);
 * default matches the width AppShell's header/main already used.
 */
function Container({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'div'> & { size?: 'default' | 'wide' | 'narrow' }) {
  return (
    <div
      data-slot="container"
      data-size={size}
      className={cn(
        'mx-auto w-full px-4 data-[size=default]:max-w-5xl data-[size=narrow]:max-w-2xl data-[size=wide]:max-w-6xl sm:px-6 lg:px-8',
        className,
      )}
      {...props}
    />
  );
}

export { Container };
