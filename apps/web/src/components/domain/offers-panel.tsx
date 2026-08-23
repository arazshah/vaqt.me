'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OfferStatus } from '@vaqt/shared';

import { Badge } from '@vaqt/ui/components/ui/badge';
import { Button } from '@vaqt/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vaqt/ui/components/ui/card';
import { PriceTag } from '@vaqt/ui/components/price-tag';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { OfferSubmitForm } from '@/components/domain/offer-submit-form';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fa } from '@/messages/fa';

export interface OfferSummary {
  id: string;
  proposedStartAt: string;
  proposedDurationMinutes: number;
  amountRial: number;
  message: string | null;
  status: OfferStatus;
  providerDisplayName: string;
}

export interface RequestDetailForOffers {
  id: string;
  status: string;
  isOwner: boolean;
  myOfferId: string | null;
  myOfferStatus: OfferStatus | null;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function OfferCard({
  offer,
  action,
}: {
  offer: OfferSummary;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            {offer.providerDisplayName}
          </CardTitle>
          <Badge variant="secondary">{fa.offerStatus[offer.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
        <span>{formatDateTime(offer.proposedStartAt)}</span>
        <span>
          {fa.requestDetailPage.labels.durationMinutes(
            String(offer.proposedDurationMinutes),
          )}
        </span>
        <PriceTag rial={offer.amountRial} className="text-foreground" />
        {offer.message ? <p>{offer.message}</p> : null}
      </CardContent>
      {action ? <CardFooter>{action}</CardFooter> : null}
    </Card>
  );
}

export function OffersPanel({
  detail,
  onChanged,
}: {
  detail: RequestDetailForOffers;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [ownerOffers, setOwnerOffers] = useState<OfferSummary[] | null>(null);
  const [loadingOffers, setLoadingOffers] = useState(detail.isOwner);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);

  const loadOwnerOffers = useCallback(async () => {
    if (!detail.isOwner) return;
    setLoadingOffers(true);
    try {
      const offers = await apiFetch<OfferSummary[]>('/offers/list', {
        method: 'POST',
        body: JSON.stringify({ requestId: detail.id }),
      });
      setOwnerOffers(offers);
    } catch {
      setOwnerOffers([]);
    } finally {
      setLoadingOffers(false);
    }
  }, [detail.id, detail.isOwner]);

  useEffect(() => {
    void loadOwnerOffers();
  }, [loadOwnerOffers]);

  async function handleSelect(offerId: string) {
    setActionError(null);
    setPendingOfferId(offerId);
    try {
      await apiFetch('/offers/select', {
        method: 'POST',
        body: JSON.stringify({ offerId }),
      });
      onChanged();
      await loadOwnerOffers();
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : fa.requestDetailPage.offers.selectError,
      );
    } finally {
      setPendingOfferId(null);
    }
  }

  async function handleWithdraw(offerId: string) {
    setActionError(null);
    setPendingOfferId(offerId);
    try {
      await apiFetch('/offers/withdraw', {
        method: 'POST',
        body: JSON.stringify({ offerId }),
      });
      onChanged();
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : fa.requestDetailPage.offers.withdrawError,
      );
    } finally {
      setPendingOfferId(null);
    }
  }

  if (detail.isOwner) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {fa.requestDetailPage.offers.sectionTitleOwner}
        </h2>
        {actionError ? (
          <p className="text-sm text-destructive">{actionError}</p>
        ) : null}
        {loadingOffers ? (
          <Skeleton className="h-32 w-full" />
        ) : !ownerOffers || ownerOffers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {fa.requestDetailPage.offers.emptyOwner}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {ownerOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                action={
                  offer.status === 'PENDING' ? (
                    <Button
                      size="sm"
                      disabled={pendingOfferId === offer.id}
                      onClick={() => void handleSelect(offer.id)}
                    >
                      {pendingOfferId === offer.id
                        ? fa.requestDetailPage.offers.selecting
                        : fa.requestDetailPage.offers.selectButton}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // A withdrawn offer can be re-submitted (it reactivates the same row —
  // see CLAUDE.md bond 14), so it isn't a dead end like every other
  // non-PENDING status: the same eligibility gates as a fresh submission
  // (request still PUBLISHED, profile still complete) decide whether the
  // form reappears below the status card.
  const canOfferNow =
    detail.status === 'PUBLISHED' && user.completeness.canSubmitOffer;

  if (detail.myOfferId && detail.myOfferStatus) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {fa.requestDetailPage.offers.sectionTitleMine}
        </h2>
        {actionError ? (
          <p className="text-sm text-destructive">{actionError}</p>
        ) : null}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                {fa.requestDetailPage.offers.sectionTitleMine}
              </CardTitle>
              <Badge variant="secondary">
                {fa.offerStatus[detail.myOfferStatus]}
              </Badge>
            </div>
          </CardHeader>
          {detail.myOfferStatus === 'PENDING' ? (
            <CardFooter>
              <Button
                variant="outline"
                size="sm"
                disabled={pendingOfferId === detail.myOfferId}
                onClick={() => void handleWithdraw(detail.myOfferId as string)}
              >
                {pendingOfferId === detail.myOfferId
                  ? fa.requestDetailPage.offers.withdrawing
                  : fa.requestDetailPage.offers.withdrawButton}
              </Button>
            </CardFooter>
          ) : null}
        </Card>
        {detail.myOfferStatus === 'WITHDRAWN' && canOfferNow ? (
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold">
              {fa.requestDetailPage.offers.resubmitTitle}
            </h3>
            <OfferSubmitForm requestId={detail.id} onSubmitted={onChanged} />
          </div>
        ) : null}
      </div>
    );
  }

  if (detail.status !== 'PUBLISHED') {
    return (
      <p className="text-sm text-muted-foreground">
        {fa.requestDetailPage.offers.notPublishedNotice}
      </p>
    );
  }

  if (!user.completeness.canSubmitOffer) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="font-semibold">
          {fa.requestDetailPage.offers.incompleteProfile.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {fa.requestDetailPage.offers.incompleteProfile.description}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        {fa.requestDetailPage.offers.sectionTitleSubmit}
      </h2>
      <OfferSubmitForm requestId={detail.id} onSubmitted={onChanged} />
    </div>
  );
}
