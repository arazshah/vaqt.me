'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  formatNumber,
  type OfferStatus,
  type RequestMode,
  type RequestStatus,
} from '@vaqt/shared';

import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@vaqt/ui/components/ui/empty';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';
import { Badge } from '@vaqt/ui/components/ui/badge';
import { PriceTag } from '@vaqt/ui/components/price-tag';

import { AppShell } from '@/components/app-shell';
import { OffersPanel } from '@/components/domain/offers-panel';
import { RequestStatusBadge } from '@/components/domain/request-status-badge';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface RequestDetailData {
  id: string;
  title: string;
  description: string;
  categoryName: string;
  mode: RequestMode;
  city: string | null;
  durationMinutes: number;
  deadlineAt: string;
  status: RequestStatus;
  offerCount: number;
  ownerDisplayName: string;
  isOwner: boolean;
  budgetMinRial: number | null;
  budgetMaxRial: number | null;
  budgetMasked: boolean;
  myOfferId: string | null;
  myOfferStatus: OfferStatus | null;
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [detail, setDetail] = useState<RequestDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    try {
      const data = await apiFetch<RequestDetailData>(`/requests/${params.id}`);
      setDetail(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (!authLoading && user) {
      void load();
    }
  }, [authLoading, user, router, load]);

  if (authLoading || !user || loading) {
    return (
      <AppShell>
        <Skeleton className="h-96 w-full max-w-2xl" />
      </AppShell>
    );
  }

  if (notFound) {
    return (
      <AppShell>
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyTitle>{fa.requestDetailPage.notFoundTitle}</EmptyTitle>
            <EmptyDescription>
              {fa.requestDetailPage.notFoundDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AppShell>
    );
  }

  if (error || !detail) {
    return (
      <AppShell>
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyTitle>{fa.requestDetailPage.errorTitle}</EmptyTitle>
            <EmptyDescription>
              {fa.requestDetailPage.errorDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AppShell>
    );
  }

  const locationLabel = [fa.requestMode[detail.mode], detail.city]
    .filter(Boolean)
    .join(' · ');

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <Link
          href="/requests"
          className="text-sm text-muted-foreground hover:underline"
        >
          {fa.requestDetailPage.backLink}
        </Link>

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-semibold">{detail.title}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {fa.requestCard.offerCount(formatNumber(detail.offerCount))}
              </Badge>
              <RequestStatusBadge status={detail.status} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {detail.categoryName}
            {locationLabel ? ` · ${locationLabel}` : ''}
          </p>
          <p className="whitespace-pre-wrap text-sm">{detail.description}</p>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">
                {fa.newRequestPage.fields.durationMinutes}
              </dt>
              <dd>
                {fa.requestDetailPage.labels.durationMinutes(
                  String(detail.durationMinutes),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {fa.requestDetailPage.labels.deadline}
              </dt>
              <dd>
                {new Intl.DateTimeFormat('fa-IR', {
                  dateStyle: 'medium',
                }).format(new Date(detail.deadlineAt))}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {fa.requestDetailPage.labels.budget}
              </dt>
              <dd>
                {detail.budgetMasked ||
                detail.budgetMinRial === null ||
                detail.budgetMaxRial === null ? (
                  <Badge variant="outline">{fa.requestCard.budgetHidden}</Badge>
                ) : (
                  <span className="flex items-center gap-1">
                    <PriceTag rial={detail.budgetMinRial} />
                    <span aria-hidden="true">{'–'}</span>
                    <PriceTag rial={detail.budgetMaxRial} />
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {fa.requestDetailPage.labels.owner}
              </dt>
              <dd>{detail.ownerDisplayName}</dd>
            </div>
          </dl>
        </div>

        <OffersPanel detail={detail} onChanged={() => void load()} />
      </div>
    </AppShell>
  );
}
