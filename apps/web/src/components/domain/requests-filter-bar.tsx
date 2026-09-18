'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { RequestMode } from '@vaqt/shared';

import { Input } from '@vaqt/ui/components/ui/input';
import { Button } from '@vaqt/ui/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vaqt/ui/components/ui/select';

import { apiFetch } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface Category {
  id: string;
  name: string;
}

export interface RequestsFilters {
  categoryId: string | null;
  mode: RequestMode | null;
  city: string | null;
  search: string | null;
}

export const EMPTY_FILTERS: RequestsFilters = {
  categoryId: null,
  mode: null,
  city: null,
  search: null,
};

// Every text field (search, city) is debounced locally and only pushed up
// to the parent (which re-fetches) after the user pauses typing — matches
// this project's "no dependency for basic client state" convention (see
// CLAUDE.md's request-form/offer-submit-form notes) rather than adding a
// debounce library for two inputs.
const TEXT_DEBOUNCE_MS = 400;

export function RequestsFilterBar({
  value,
  onChange,
}: {
  value: RequestsFilters;
  onChange: (next: RequestsFilters) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchDraft, setSearchDraft] = useState(value.search ?? '');
  const [cityDraft, setCityDraft] = useState(value.city ?? '');

  // Kept current on every render and read from inside the debounce timers
  // below instead of closing over `value`/`onChange` directly — that lets
  // those effects declare only [searchDraft]/[cityDraft] as deps (true and
  // complete, no eslint-disable needed) while still always acting on the
  // latest filter state and callback, not a stale render's.
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => {
    // /categories requires an authenticated session (no @Public() —
    // CategoriesController), but this filter bar also renders for guests on
    // the public /requests list. Without redirectOnAuthFailure: false, a
    // guest's 401 here would hard-redirect them to /login off a page they
    // never needed an account to view — the same class of bug documented
    // for the initial GET /auth/me call in auth-context.tsx. A guest simply
    // sees the category select with only "همه‌ی دسته‌ها" (server-side
    // filtering by category still only works with a real id from a logged-
    // in fetch, but browsing/searching without it is unaffected).
    apiFetch<{ items: Category[] }>('/categories', undefined, {
      redirectOnAuthFailure: false,
    })
      .then((res) => {
        setCategories(res.items);
      })
      .catch(() => {
        setCategories([]);
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const { value: current, onChange: notify } = latest.current;
      const trimmed = searchDraft.trim();
      if (trimmed !== (current.search ?? '')) {
        notify({ ...current, search: trimmed || null });
      }
    }, TEXT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [searchDraft]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const { value: current, onChange: notify } = latest.current;
      const trimmed = cityDraft.trim();
      if (trimmed !== (current.city ?? '')) {
        notify({ ...current, city: trimmed || null });
      }
    }, TEXT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [cityDraft]);

  const hasActiveFilters =
    value.categoryId !== null ||
    value.mode !== null ||
    value.city !== null ||
    value.search !== null;

  function handleClear() {
    setSearchDraft('');
    setCityDraft('');
    onChange(EMPTY_FILTERS);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:basis-64">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={searchDraft}
          onChange={(e) => {
            setSearchDraft(e.target.value);
          }}
          placeholder={fa.requestsPage.filters.searchPlaceholder}
          // listRequestsSchema caps search at 120 chars — bounding the
          // input the same way means a user typing past that limit gets
          // stopped at the edge instead of sending a value the server
          // rejects with a 400 (which this page then shows as a generic
          // connection-error state, not a helpful "too long" message).
          maxLength={120}
          className="ps-9"
        />
      </div>

      <Select
        value={value.categoryId ?? '__all__'}
        onValueChange={(v) => {
          onChange({ ...value, categoryId: v === '__all__' ? null : v });
        }}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={fa.requestsPage.filters.categoryAll} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">
            {fa.requestsPage.filters.categoryAll}
          </SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.mode ?? '__all__'}
        onValueChange={(v) => {
          onChange({
            ...value,
            mode: v === '__all__' ? null : (v as RequestMode),
          });
        }}
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder={fa.requestsPage.filters.modeAll} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">
            {fa.requestsPage.filters.modeAll}
          </SelectItem>
          {(Object.keys(fa.requestMode) as RequestMode[]).map((mode) => (
            <SelectItem key={mode} value={mode}>
              {fa.requestMode[mode]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={cityDraft}
        onChange={(e) => {
          setCityDraft(e.target.value);
        }}
        placeholder={fa.requestsPage.filters.cityPlaceholder}
        // Same reasoning as the search input's maxLength above —
        // listRequestsSchema caps city at 80 chars.
        maxLength={80}
        className="w-full sm:w-32"
      />

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="gap-1.5"
        >
          <X className="size-3.5" aria-hidden="true" />
          {fa.requestsPage.filters.clear}
        </Button>
      ) : null}
    </div>
  );
}
