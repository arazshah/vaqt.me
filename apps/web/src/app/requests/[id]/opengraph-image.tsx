import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { fetchPublicRequestSummary } from '@/lib/seo/request-summary';
import { fa } from '@/messages/fa';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// next/font's woff2 files aren't usable here — Satori/resvg (the renderer
// behind next/og's ImageResponse) throws "Unsupported OpenType signature
// wOF2" on the variable woff2 in public/fonts. Verified live: swapping to a
// plain TTF (fetched from the same rastikerdar/vazirmatn release referenced
// in CLAUDE.md bond 2) renders Farsi correctly — both intra-word glyph
// joining and RTL word order came out right in a manual render check.
async function loadFont() {
  return readFile(join(process.cwd(), 'src/assets/fonts/Vazirmatn-Bold.ttf'));
}

// Satori (the layout engine behind ImageResponse) mis-handles ZWNJ
// (نیم‌فاصله, U+200C) — verified live: a compound word like "توسعه‌دهنده‌ی"
// gets each ZWNJ-separated segment treated as its own bidi run and
// reordered independently, scrambling the word ("ی‌دهندهتوسعه" instead of
// "توسعه‌دهنده‌ی") even though plain space-separated RTL text and
// intra-segment letter joining both render correctly. Persian compound
// words with ZWNJ are common (this app's own normalizeFa() treats it as a
// first-class character), so every string handed to Satori here is
// desperately sanitized to a plain space first — a real space instead of
// the pseudo-space is a minor typographic loss next to a scrambled title.
function stripZwnj(text: string): string {
  return text.replace(/‌/g, ' ');
}

export default async function Image({ params }: { params: { id: string } }) {
  const [summary, fontData] = await Promise.all([
    fetchPublicRequestSummary(params.id),
    loadFont(),
  ]);

  const title = stripZwnj(summary?.title ?? fa.requestDetailPage.notFoundTitle);
  const subtitle = summary
    ? stripZwnj(
        [summary.categoryName, fa.requestMode[summary.mode], summary.city]
          .filter(Boolean)
          .join(' · '),
      )
    : 'Vaqt.me';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        background: '#2E2547',
        color: '#EDE9F7',
        fontFamily: 'vazirmatn',
        direction: 'rtl',
      }}
    >
      <div style={{ fontSize: 28, opacity: 0.75, display: 'flex' }}>
        Vaqt.me
      </div>
      <div
        style={{
          fontSize: 56,
          fontWeight: 700,
          marginTop: 24,
          lineHeight: 1.4,
          display: 'flex',
        }}
      >
        {title}
      </div>
      <div
        style={{ fontSize: 30, opacity: 0.85, marginTop: 32, display: 'flex' }}
      >
        {subtitle}
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: 'vazirmatn', data: fontData, style: 'normal' }],
    },
  );
}
