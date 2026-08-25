'use client';

import { useEffect, useState } from 'react';
import { ProductCode } from '@vaqt/shared';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vaqt/ui/components/ui/card';
import { PriceTag } from '@vaqt/ui/components/price-tag';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { PurchaseButton } from '@/components/domain/purchase-button';
import { apiFetch } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface ProductView {
  code: ProductCode;
  title: string;
  description: string;
  priceRial: number;
  durationHours: number | null;
}

export interface RequestDetailForUpgrades {
  id: string;
  status: string;
  isOwner: boolean;
  isUrgent: boolean;
  isFeatured: boolean;
  bumpedAt: string | null;
}

// Request-scoped upgrades only (URGENT_BADGE, BUMP, FEATURE — see
// checkoutSchema's comment in @vaqt/shared). PRO_MONTHLY/TARGETED_NOTIFY
// are account-level and live on /pricing instead.
const REQUEST_SCOPED_CODES: ProductCode[] = [
  ProductCode.URGENT_BADGE,
  ProductCode.BUMP,
  ProductCode.FEATURE,
];

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function RequestUpgrades({
  detail,
}: {
  detail: RequestDetailForUpgrades;
}) {
  const [products, setProducts] = useState<ProductView[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ProductView[]>('/payments/products')
      .then((all) => {
        if (!cancelled) {
          setProducts(all.filter((p) => REQUEST_SCOPED_CODES.includes(p.code)));
        }
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!detail.isOwner || detail.status !== 'PUBLISHED') {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        {fa.requestDetailPage.upgrades.sectionTitle}
      </h2>
      {products === null ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {products.map((product) => {
            const isUrgent = product.code === ProductCode.URGENT_BADGE;
            const isFeature = product.code === ProductCode.FEATURE;
            const alreadyOwned =
              (isUrgent && detail.isUrgent) || (isFeature && detail.isFeatured);

            return (
              <Card key={product.code}>
                <CardHeader>
                  <CardTitle className="text-base">{product.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <p>{product.description}</p>
                  <PriceTag
                    rial={product.priceRial}
                    className="text-foreground"
                  />
                  {isUrgent && alreadyOwned ? (
                    <p>{fa.requestDetailPage.upgrades.alreadyUrgent}</p>
                  ) : null}
                  {isFeature && alreadyOwned ? (
                    <p>{fa.requestDetailPage.upgrades.alreadyFeatured}</p>
                  ) : null}
                  {product.code === ProductCode.BUMP ? (
                    <p>
                      {detail.bumpedAt
                        ? fa.requestDetailPage.upgrades.bumpLastAt(
                            formatDateTime(detail.bumpedAt),
                          )
                        : fa.requestDetailPage.upgrades.bumpNeverYet}
                    </p>
                  ) : null}
                </CardContent>
                <CardFooter>
                  <PurchaseButton
                    productCode={product.code}
                    requestId={detail.id}
                    label={fa.payment.buyButton}
                    disabled={alreadyOwned}
                    variant="outline"
                  />
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
