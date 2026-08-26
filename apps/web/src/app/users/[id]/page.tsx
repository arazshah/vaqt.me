'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { CursorPage } from '@vaqt/shared';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@vaqt/ui/components/ui/avatar';
import { Badge } from '@vaqt/ui/components/ui/badge';
import { Card, CardContent, CardHeader } from '@vaqt/ui/components/ui/card';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@vaqt/ui/components/ui/empty';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';
import { Button } from '@vaqt/ui/components/ui/button';

import { AppShell } from '@/components/app-shell';
import { StarRating } from '@/components/domain/star-rating';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface PublicProfile {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarThumbnailUrl: string | null;
  city: string | null;
  ratingAvg: number;
  ratingCount: number;
  skills: { id: string; name: string }[];
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { id: string; displayName: string; avatarUrl: string | null };
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(
    new Date(iso),
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarImage src={review.reviewer.avatarUrl ?? undefined} />
            <AvatarFallback>
              {review.reviewer.displayName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">
            {review.reviewer.displayName}
          </span>
        </div>
        <StarRating
          value={review.rating}
          readOnly
          ariaLabel={fa.profilePage.ratingLabel}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        {review.comment ? <p>{review.comment}</p> : null}
        <span className="text-xs">{formatDate(review.createdAt)}</span>
      </CardContent>
    </Card>
  );
}

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(false);
    setNotFound(false);
    try {
      const data = await apiFetch<PublicProfile>(`/users/${params.id}`);
      setProfile(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setProfileError(true);
      }
    } finally {
      setProfileLoading(false);
    }
  }, [params.id]);

  const loadReviews = useCallback(
    async (cursor: string | null) => {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setReviewsLoading(true);
      }
      try {
        const page = await apiFetch<CursorPage<ReviewItem>>('/reviews/list', {
          method: 'POST',
          body: JSON.stringify({ userId: params.id, cursor }),
        });
        setReviews((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch {
        if (!cursor) {
          setReviews([]);
        }
      } finally {
        setReviewsLoading(false);
        setLoadingMore(false);
      }
    },
    [params.id],
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (!authLoading && user) {
      void loadProfile();
      void loadReviews(null);
    }
  }, [authLoading, user, router, loadProfile, loadReviews]);

  if (authLoading || !user || profileLoading) {
    return (
      <AppShell>
        <Skeleton className="h-64 w-full max-w-2xl" />
      </AppShell>
    );
  }

  if (notFound) {
    return (
      <AppShell>
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyTitle>{fa.profilePage.notFoundTitle}</EmptyTitle>
            <EmptyDescription>
              {fa.profilePage.notFoundDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AppShell>
    );
  }

  if (profileError || !profile) {
    return (
      <AppShell>
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyTitle>{fa.profilePage.errorTitle}</EmptyTitle>
            <EmptyDescription>
              {fa.profilePage.errorDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-start gap-4">
          <Avatar size="lg">
            <AvatarImage src={profile.avatarThumbnailUrl ?? undefined} />
            <AvatarFallback>{profile.displayName.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">{profile.displayName}</h1>
            {profile.headline ? (
              <p className="text-sm text-muted-foreground">
                {profile.headline}
              </p>
            ) : null}
            {profile.city ? (
              <Badge variant="secondary" className="w-fit">
                {profile.city}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StarRating
            value={profile.ratingAvg}
            readOnly
            ariaLabel={fa.profilePage.ratingLabel}
          />
          <span className="text-sm text-muted-foreground">
            {fa.profilePage.successfulCollaborations(
              String(profile.ratingCount),
            )}
          </span>
        </div>

        {profile.bio ? <p className="text-sm">{profile.bio}</p> : null}

        {profile.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <Badge key={skill.id} variant="outline">
                {skill.name}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            {fa.profilePage.reviewsSectionTitle}
          </h2>
          {reviewsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {fa.profilePage.noReviewsYet}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
              {nextCursor ? (
                <Button
                  variant="outline"
                  disabled={loadingMore}
                  onClick={() => void loadReviews(nextCursor)}
                >
                  {loadingMore
                    ? fa.profilePage.loadingMore
                    : fa.profilePage.loadMore}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
