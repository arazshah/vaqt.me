'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductCode } from '@vaqt/shared';
import { Bell, Crown, Sparkles } from 'lucide-react';

import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@vaqt/ui/components/ui/empty';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vaqt/ui/components/ui/card';
import { PriceTag } from '@vaqt/ui/components/price-tag';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { PurchaseButton } from '@/components/domain/purchase-button';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';
import { fa } from '@/messages/fa';

const PRODUCT_ICONS: Record<ProductCode, typeof Crown> = {
  [ProductCode.PRO_MONTHLY]: Crown,
  [ProductCode.TARGETED_NOTIFY]: Bell,
  [ProductCode.URGENT_BADGE]: Sparkles,
  [ProductCode.BUMP]: Sparkles,
  [ProductCode.FEATURE]: Sparkles,
};

interface ProductView {
  code: ProductCode;
  title: string;
  description: string;
  priceRial: number;
  durationHours: number | null;
}

// Account-level products only — URGENT_BADGE/BUMP/FEATURE are
// request-scoped and live on each request's detail page instead (see
// RequestUpgrades). checkoutSchema documents that split in @vaqt/shared.
const ACCOUNT_LEVEL_CODES: ProductCode[] = [
  ProductCode.PRO_MONTHLY,
  ProductCode.TARGETED_NOTIFY,
];

export default function PricingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<ProductView[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const all = await apiFetch<ProductView[]>('/payments/products');
      setProducts(all.filter((p) => ACCOUNT_LEVEL_CODES.includes(p.code)));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (!authLoading && user) {
      void load();
    }
  }, [authLoading, user, router, load]);

  if (authLoading || !user) {
    return (
      <AppShell>
        <Skeleton className="h-64 w-full max-w-2xl" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Crown className="size-6 text-primary" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold">{fa.pricingPage.title}</h1>
          <p className="text-sm text-muted-foreground">
            {fa.pricingPage.description}
          </p>
        </div>

        {error ? (
          <Empty className="max-w-sm">
            <EmptyHeader>
              <EmptyTitle>{fa.pricingPage.errorTitle}</EmptyTitle>
              <EmptyDescription>
                {fa.pricingPage.errorDescription}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : products === null ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {products.map((product) => {
              const Icon = PRODUCT_ICONS[product.code];
              return (
                <Card
                  key={product.code}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                        <Icon
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                      </span>
                      <CardTitle className="text-base">
                        {product.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <p>{product.description}</p>
                    <PriceTag
                      rial={product.priceRial}
                      className="text-foreground"
                    />
                    {product.durationHours ? (
                      <p>
                        {fa.pricingPage.durationHours(
                          String(product.durationHours),
                        )}
                      </p>
                    ) : null}
                  </CardContent>
                  <CardFooter>
                    <PurchaseButton
                      productCode={product.code}
                      label={fa.payment.buyButton}
                    />
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
