'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { LocateFixed, MapPinOff } from 'lucide-react';
import { normalizeContactPhone, type GeoPoint } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';
import { Textarea } from '@vaqt/ui/components/ui/textarea';

import { fa } from '@/messages/fa';

const LocationMap = dynamic(
  () => import('./location-map').then((m) => m.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />
    ),
  },
);

export function ContactLocationFields({
  contactPhone,
  address,
  location,
  onChange,
}: {
  contactPhone: string;
  address: string;
  location: GeoPoint | null;
  onChange: (
    patch: Partial<{
      contactPhone: string;
      address: string;
      location: GeoPoint | null;
    }>,
  ) => void;
}) {
  const t = fa.editor.contact;
  const [token, setToken] = useState(0);
  const [geoError, setGeoError] = useState(false);
  const phoneInvalid =
    contactPhone.trim() !== '' && normalizeContactPhone(contactPhone) === null;

  function useMyLocation() {
    setGeoError(false);
    if (!('geolocation' in navigator)) {
      setGeoError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          location: {
            lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
            lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
          },
        });
        setToken((n) => n + 1);
      },
      () => {
        setGeoError(true);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-phone">{t.phone}</Label>
        <Input
          id="contact-phone"
          dir="ltr"
          inputMode="tel"
          autoComplete="off"
          value={contactPhone}
          maxLength={30}
          placeholder="021 1234 5678"
          aria-invalid={phoneInvalid}
          onChange={(e) => {
            onChange({ contactPhone: e.target.value });
          }}
        />
        <p
          className={`text-xs ${phoneInvalid ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {phoneInvalid ? t.phoneInvalid : t.phoneHelp}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-address">{t.address}</Label>
        <Textarea
          id="contact-address"
          rows={3}
          maxLength={300}
          value={address}
          placeholder={t.addressPlaceholder}
          onChange={(e) => {
            onChange({ address: e.target.value });
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t.map}</Label>
        <p className="text-xs text-muted-foreground">{t.mapHelp}</p>
        <LocationMap
          value={location}
          recenterToken={token}
          onChange={(p) => {
            onChange({ location: p });
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={useMyLocation}
          >
            <LocateFixed className="size-4" aria-hidden="true" />
            {t.useMyLocation}
          </Button>
          {location ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange({ location: null });
              }}
            >
              <MapPinOff className="size-4" aria-hidden="true" />
              {t.removePin}
            </Button>
          ) : null}
        </div>
        {geoError ? (
          <p role="alert" className="text-xs text-destructive">
            {t.geoError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
