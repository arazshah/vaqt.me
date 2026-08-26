import type { Metadata } from 'next';
import {
  fetchPublicRequestSummary,
  requestSummaryDescription,
} from '@/lib/seo/request-summary';
import { fa } from '@/messages/fa';
import RequestDetailClient from './request-detail-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const summary = await fetchPublicRequestSummary(id);
  if (!summary) {
    return {
      title: `${fa.requestDetailPage.notFoundTitle} | Vaqt.me`,
      description: fa.requestDetailPage.notFoundDescription,
    };
  }

  const title = `${summary.title} | Vaqt.me`;
  const description = requestSummaryDescription(summary);
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function RequestDetailPage({ params }: PageProps) {
  const { id } = await params;
  const summary = await fetchPublicRequestSummary(id);

  return (
    <>
      {summary && (
        <script
          type="application/ld+json"
          // JSON.stringify output here is never attacker-controlled HTML —
          // every field comes from the same trusted, already-public
          // RequestListItem shape (title/categoryName/city/mode/owner
          // display name), not raw user HTML.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              // Demand — schema.org's type for "wanted" classifieds, which
              // is exactly what a Vaqt.me request is: a public announcement
              // seeking a service, not an offer of one.
              '@type': 'Demand',
              name: summary.title,
              category: summary.categoryName,
              ...(summary.city
                ? { areaServed: { '@type': 'City', name: summary.city } }
                : {}),
              itemOffered: {
                '@type': 'Service',
                name: summary.categoryName,
              },
              seller: { '@type': 'Person', name: summary.ownerDisplayName },
            }),
          }}
        />
      )}
      <RequestDetailClient />
    </>
  );
}
