'use client';

import { useState } from 'react';
import type { ProductCode } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';

import { apiFetch, ApiError } from '@/lib/api-client';
import { fa } from '@/messages/fa';

export interface CheckoutResult {
  orderId: string;
  redirectUrl: string;
}

// A successful checkout navigates the whole browser away (to the gateway
// for a real Zarinpal purchase, or straight to our own callback for the
// mock adapter — see CLAUDE.md Phase 9), so there's no "success" state to
// render here; the component's job ends at redirectUrl.
export function PurchaseButton({
  productCode,
  requestId,
  label,
  disabled = false,
  variant = 'default',
  size = 'sm',
}: {
  productCode: ProductCode;
  requestId?: string;
  label: string;
  disabled?: boolean;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<CheckoutResult>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          productCode,
          requestId: requestId ?? null,
        }),
      });
      window.location.href = result.redirectUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fa.payment.buyError);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || loading}
        onClick={() => void handleClick()}
      >
        {loading ? fa.payment.buying : label}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
