import {
  formatNumber,
  type RequestMode,
  type RequestStatus,
} from '@vaqt/shared';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vaqt/ui/components/ui/card';
import { Badge } from '@vaqt/ui/components/ui/badge';
import { Avatar, AvatarFallback } from '@vaqt/ui/components/ui/avatar';
import { PriceTag } from '@vaqt/ui/components/price-tag';

import { fa } from '@/messages/fa';
import { RequestStatusBadge } from '@/components/domain/request-status-badge';

export type RequestCardData = {
  id: string;
  title: string;
  categoryName: string;
  city: string | null;
  mode: RequestMode;
  status: RequestStatus;
  offerCount: number;
  ownerDisplayName: string;
  /**
   * Rial. Both null when the viewer isn't allowed to see the budget yet
   * (guest or phone-unverified user — see CLAUDE.md bond 6). This
   * component never decides that on its own; it only renders what it's
   * given.
   */
  budgetMinRial: number | null;
  budgetMaxRial: number | null;
};

export function RequestCard({ data }: { data: RequestCardData }) {
  const locationLabel = [fa.requestMode[data.mode], data.city]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{data.title}</CardTitle>
          <RequestStatusBadge status={data.status} />
        </div>
        <CardDescription>
          {data.categoryName}
          {locationLabel ? ` · ${locationLabel}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarFallback>{data.ownerDisplayName.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            {data.ownerDisplayName}
          </span>
        </div>
        {data.budgetMinRial != null && data.budgetMaxRial != null ? (
          <span className="flex items-center gap-1 text-sm">
            <PriceTag rial={data.budgetMinRial} />
            <span aria-hidden="true">{'–'}</span>
            <PriceTag rial={data.budgetMaxRial} />
          </span>
        ) : (
          <Badge variant="outline">{fa.requestCard.budgetHidden}</Badge>
        )}
      </CardContent>
      <CardFooter>
        <Badge variant="secondary">
          {fa.requestCard.offerCount(formatNumber(data.offerCount))}
        </Badge>
      </CardFooter>
    </Card>
  );
}
