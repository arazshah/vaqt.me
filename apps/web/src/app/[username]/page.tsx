import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normalizeSource } from '@vaqt/shared';

import { fetchPublicCard } from '@/lib/card';
import { getRequestOrigin } from '@/lib/site';
import { fa } from '@/messages/fa';
import { CardView } from './card-view';

interface PageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ src?: string | string[] }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  const card = await fetchPublicCard(username);
  if (!card) {
    return { title: fa.cardPage.notFoundTitle, robots: { index: false } };
  }
  const title = `${card.displayName} | ${fa.appShell.brand}`;
  const description = fa.cardPage.metaDescription(
    card.displayName,
    card.headline ?? '',
  );
  return {
    title,
    description,
    alternates: { canonical: `/${card.username}` },
    openGraph: { title, description, type: 'profile' },
  };
}

export default async function CardPage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const { src } = await searchParams;
  const card = await fetchPublicCard(username);
  if (!card) notFound();
  const origin = await getRequestOrigin();

  return (
    <CardView
      card={card}
      cardUrl={`${origin}/${card.username}`}
      source={normalizeSource(Array.isArray(src) ? src[0] : src)}
    />
  );
}
