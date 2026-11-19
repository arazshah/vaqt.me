'use client';

import { useEffect, useRef } from 'react';
import type { GeoPoint } from '@vaqt/shared';

import 'leaflet/dist/leaflet.css';

// Tehran — where an empty picker opens.
const DEFAULT_CENTER: GeoPoint = { lat: 35.6892, lng: 51.389 };
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * An OpenStreetMap view with one pin. With `onChange` it is a picker (tap the
 * map or drag the pin); without, a read-only display. Leaflet touches
 * `window`, so it is imported inside the effect, never at module load.
 */
export function LocationMap({
  value,
  onChange,
  className = 'h-64',
  recenterToken,
}: {
  value: GeoPoint | null;
  onChange?: (point: GeoPoint) => void;
  className?: string;
  /** Bump to re-center on `value` (e.g. after "use my location"). */
  recenterToken?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    set: (p: GeoPoint, recenter: boolean) => void;
  } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initial = useRef(value);

  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => undefined;
    void import('leaflet').then((L) => {
      if (disposed || !host.current) return;
      const start = initial.current ?? DEFAULT_CENTER;
      const interactive = Boolean(onChangeRef.current);
      const map = L.map(host.current, {
        center: [start.lat, start.lng],
        zoom: initial.current ? 16 : 11,
        dragging: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer(TILES, {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map);

      const icon = L.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#e11d48;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);transform:rotate(-45deg)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      let marker: import('leaflet').Marker | null = null;

      const place = (p: GeoPoint, recenter: boolean) => {
        if (!marker) {
          marker = L.marker([p.lat, p.lng], {
            icon,
            draggable: interactive,
          }).addTo(map);
          marker.on('dragend', () => {
            const ll = marker?.getLatLng();
            if (ll)
              onChangeRef.current?.({ lat: round(ll.lat), lng: round(ll.lng) });
          });
        } else {
          marker.setLatLng([p.lat, p.lng]);
        }
        if (recenter) map.setView([p.lat, p.lng], Math.max(map.getZoom(), 16));
      };
      if (initial.current) place(initial.current, false);

      if (interactive) {
        map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
          const p = { lat: round(e.latlng.lat), lng: round(e.latlng.lng) };
          place(p, false);
          onChangeRef.current?.(p);
        });
      }
      api.current = {
        set: (p, recenter) => {
          place(p, recenter);
        },
      };
      cleanup = () => {
        api.current = null;
        map.remove();
      };
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  // Keep the pin in sync when the value changes from outside the map.
  const lastToken = useRef(recenterToken);
  useEffect(() => {
    if (!value) return;
    const recenter = lastToken.current !== recenterToken;
    lastToken.current = recenterToken;
    api.current?.set(value, recenter);
  }, [value, recenterToken]);

  return (
    <div
      ref={host}
      dir="ltr"
      className={`z-0 w-full overflow-hidden rounded-2xl border bg-muted ${className}`}
    />
  );
}
