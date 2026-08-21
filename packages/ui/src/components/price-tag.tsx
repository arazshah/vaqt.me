import * as React from 'react';
import { formatToman } from '@vaqt/shared';

import { cn } from '@vaqt/ui/lib/utils';

export type PriceTagProps = {
  /** Amount in Rial — the only unit stored anywhere in this codebase. */
  rial: number;
} & Omit<React.ComponentProps<'span'>, 'children'>;

/**
 * Displays a Rial amount as a Toman-formatted, Persian-digit price.
 * Conversion and formatting both happen inside formatToman(); callers
 * never divide by 10 themselves.
 */
function PriceTag({ rial, className, ...props }: PriceTagProps) {
  return (
    <span
      data-slot="price-tag"
      className={cn('font-medium tabular-nums', className)}
      {...props}
    >
      {formatToman(rial)}
    </span>
  );
}

export { PriceTag };
