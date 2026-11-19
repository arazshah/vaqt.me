import Link from 'next/link';

import { Button } from '@vaqt/ui/components/ui/button';

import { AppShell } from '@/components/app-shell';
import { fa } from '@/messages/fa';

export default function CardNotFound() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-2xl font-semibold">{fa.cardPage.notFoundTitle}</h1>
        <p className="text-muted-foreground">
          {fa.cardPage.notFoundDescription}
        </p>
        <Button asChild variant="outline">
          <Link href="/">{fa.cardPage.backHome}</Link>
        </Button>
      </div>
    </AppShell>
  );
}
