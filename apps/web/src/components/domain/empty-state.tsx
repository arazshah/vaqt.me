import Link from 'next/link';
import { IdCard } from 'lucide-react';

import { Button } from '@vaqt/ui/components/ui/button';

/** Friendly "do this first" block instead of a bare sentence and button. */
export function NeedCardState({
  text,
  action,
}: {
  text: string;
  action: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border bg-card p-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <IdCard className="size-8" aria-hidden="true" />
      </span>
      <p className="m-0 leading-7">{text}</p>
      <Button asChild size="lg">
        <Link href="/card/edit">{action}</Link>
      </Button>
    </div>
  );
}
