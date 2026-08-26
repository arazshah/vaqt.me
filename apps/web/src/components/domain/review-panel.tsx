'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@vaqt/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@vaqt/ui/components/ui/card';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';
import { Textarea } from '@vaqt/ui/components/ui/textarea';

import { StarRating } from '@/components/domain/star-rating';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface ReviewStatus {
  reviewed: boolean;
  rating: number | null;
  comment: string | null;
}

// Reviewing is allowed from the moment a conversation exists (i.e. once an
// offer has been selected), regardless of OPEN/ARCHIVED status — there is
// no "mark this collaboration complete" feature in this codebase yet, so
// gating on that would be a whole separate product decision (see CLAUDE.md
// Phase 10 design notes). This panel is shown unconditionally by the
// conversation page.
export function ReviewPanel({ conversationId }: { conversationId: string }) {
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ReviewStatus>('/reviews/status', {
        method: 'POST',
        body: JSON.stringify({ conversationId }),
      });
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleSubmit() {
    setError(null);
    if (rating < 1) {
      setError(fa.reviewPanel.ratingRequiredError);
      return;
    }
    setPending(true);
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      await loadStatus();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : fa.reviewPanel.genericError,
      );
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!status) {
    return null;
  }

  if (status.reviewed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {fa.reviewPanel.alreadyReviewedTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <StarRating
            value={status.rating ?? 0}
            readOnly
            ariaLabel={fa.reviewPanel.ratingLabel}
          />
          {status.comment ? (
            <p className="text-sm text-muted-foreground">{status.comment}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{fa.reviewPanel.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <StarRating
          value={rating}
          onChange={setRating}
          ariaLabel={fa.reviewPanel.ratingLabel}
        />
        <Textarea
          rows={3}
          placeholder={fa.reviewPanel.commentPlaceholder}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
          }}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          type="button"
          disabled={pending}
          onClick={() => void handleSubmit()}
        >
          {pending ? fa.reviewPanel.submitting : fa.reviewPanel.submitButton}
        </Button>
      </CardContent>
    </Card>
  );
}
