import * as React from 'react';

import { cn } from '@vaqt/ui/lib/utils';
import { Input } from '@vaqt/ui/components/ui/input';

/**
 * Shared className for any field whose *content* is inherently
 * left-to-right (phone numbers, emails, URLs, English text) but lives
 * inside an RTL form: force `dir="ltr"` so digits/Latin characters read
 * correctly, while `text-end` keeps the field's content anchored to the
 * same edge (the right, in RTL) as its label and every other field in the
 * form. Apply this instead of ad-hoc `dir="ltr"` at each call site.
 */
export const bidiFieldClassName = 'text-end';

export type BidiInputProps = React.ComponentProps<typeof Input>;

/**
 * An `Input` pre-configured for left-to-right content (phone, email, URL)
 * inside an RTL page. See {@link bidiFieldClassName}.
 */
function BidiInput({ className, dir: _dir, ...props }: BidiInputProps) {
  return (
    <Input dir="ltr" className={cn(bidiFieldClassName, className)} {...props} />
  );
}

export { BidiInput };
