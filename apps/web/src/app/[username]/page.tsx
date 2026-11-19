import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { fetchPublicCard } from '@/lib/card';
import { WEB_ORIGIN } from '@/lib/site';
import { fa } from '@/messages/fa';
import { CardView } from './card-view';

interface PageProps {
  params: Promise<{ username: string }>;
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

export default async function CardPage({ params }: PageProps) {
  const { username } = await params;
  const card = await fetchPublicCard(username);
  if (!card) notFound();

  return <CardView card={card} cardUrl={`${WEB_ORIGIN}/${card.username}`} />;
}
