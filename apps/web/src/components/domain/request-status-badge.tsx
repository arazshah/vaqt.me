import type { RequestStatus } from '@vaqt/shared';
import { Badge } from '@vaqt/ui/components/ui/badge';

import { fa } from '@/messages/fa';

const VARIANT_BY_STATUS: Record<
  RequestStatus,
  React.ComponentProps<typeof Badge>['variant']
> = {
  DRAFT: 'secondary',
  PUBLISHED: 'default',
  OFFER_SELECTED: 'default',
  CLOSED: 'outline',
  EXPIRED: 'destructive',
  REMOVED: 'destructive',
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge variant={VARIANT_BY_STATUS[status]}>
      {fa.requestStatus[status]}
    </Badge>
  );
}
