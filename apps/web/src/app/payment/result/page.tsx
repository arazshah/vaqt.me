'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { OrderStatus } from '@vaqt/shared';

import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@vaqt/ui/components/ui/empty';
import { Badge } from '@vaqt/ui/components/ui/badge';
import { Button } from '@vaqt/ui/components/ui/button';
import { PriceTag } from '@vaqt/ui/components/price-tag';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface OrderView {
  id: string;
  status: OrderStatus;
  amountRial: number;
  productCode: string;
  productTitle: string;
  refId: string | null;
  paidAt: string | null;
  createdAt: string;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

// The API's callback redirect (see CLAUDE.md Phase 9) always lands here
// with ?status=success|failed|not_found and, unless status=not_found, an
// ?order=<id> to fetch the details from. `status` alone is enough to
// render the headline outcome even if the order fetch itself fails.
function PaymentResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const status = searchParams.get('status');
  const orderId = searchParams.get('order');
  const [order, setOrder] = useState<OrderView | null>(null);
  const [orderLoading, setOrderLoading] = useState(Boolean(orderId));

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!orderId || authLoading || !user) return;
    let cancelled = false;
    apiFetch<OrderView>(`/payments/order?id=${encodeURIComponent(orderId)}`)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      })
      .finally(() => {
        if (!cancelled) setOrderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, authLoading, user]);

  if (authLoading || !user) {
    return <Skeleton className="h-64 w-full max-w-md" />;
  }

  const outcome =
    status === 'success'
      ? fa.paymentResultPage.success
      : status === 'failed'
        ? fa.paymentResultPage.failed
        : fa.paymentResultPage.notFound;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{outcome.title}</EmptyTitle>
          <EmptyDescription>{outcome.description}</EmptyDescription>
        </EmptyHeader>
      </Empty>

      {orderLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : order ? (
        <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">
              {fa.paymentResultPage.orderLabels.product}
            </dt>
            <dd>{order.productTitle}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {fa.paymentResultPage.orderLabels.amount}
            </dt>
            <dd>
              <PriceTag rial={order.amountRial} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {fa.paymentResultPage.orderLabels.status}
            </dt>
            <dd>
              <Badge variant="secondary">
                {fa.paymentResultPage.orderStatus[order.status]}
              </Badge>
            </dd>
          </div>
          {order.refId ? (
            <div>
              <dt className="text-muted-foreground">
                {fa.paymentResultPage.orderLabels.refId}
              </dt>
              <dd className="font-mono text-xs">{order.refId}</dd>
            </div>
          ) : null}
          {order.paidAt ? (
            <div>
              <dt className="text-muted-foreground">
                {fa.paymentResultPage.orderLabels.paidAt}
              </dt>
              <dd>{formatDateTime(order.paidAt)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <Button variant="outline" asChild>
        <Link href="/requests">{fa.paymentResultPage.backToRequests}</Link>
      </Button>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-md" />}>
        <PaymentResultContent />
      </Suspense>
    </AppShell>
  );
}
