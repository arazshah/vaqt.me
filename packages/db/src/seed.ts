// Dev-only demo data: one specialist with a public card, a few contact links,
// two services and a weekly schedule, so vaqt.me/demo works out of the box.
// Idempotent (fixed ids, upsert). Never run in production.
import { prisma } from './index';

const DEMO_ID = 'seed-demo-user';

async function main() {
  console.log('Seeding database...');

  await prisma.user.upsert({
    where: { id: DEMO_ID },
    create: {
      id: DEMO_ID,
      phone: '+989000000001',
      username: 'demo',
      phoneVerifiedAt: new Date(),
      displayName: 'دکتر نمونه',
      headline: 'مشاور خانواده',
      bio: 'این یک کارت نمونه برای توسعه است.',
      city: 'تهران',
    },
    update: {},
  });

  await prisma.card.upsert({
    where: { userId: DEMO_ID },
    create: { userId: DEMO_ID, bookingEnabled: true },
    update: {},
  });

  const links = [
    { kind: 'bale', value: 'demo' },
    { kind: 'telegram', value: 'demo' },
    { kind: 'instagram', value: 'demo' },
  ];
  for (const [order, l] of links.entries()) {
    await prisma.contactLink.upsert({
      where: { userId_kind: { userId: DEMO_ID, kind: l.kind } },
      create: { userId: DEMO_ID, order, ...l },
      update: {},
    });
  }

  const services = [
    {
      id: 'seed-svc-1',
      name: 'جلسه‌ی مشاوره',
      durationMinutes: 45,
      mode: 'ONLINE',
    },
    {
      id: 'seed-svc-2',
      name: 'جلسه‌ی حضوری',
      durationMinutes: 60,
      mode: 'IN_PERSON',
    },
  ];
  for (const [order, s] of services.entries()) {
    await prisma.serviceType.upsert({
      where: { id: s.id },
      create: { userId: DEMO_ID, order, ...s },
      update: {},
    });
  }

  await prisma.availabilityRule.deleteMany({ where: { userId: DEMO_ID } });
  // Sat–Wed (weekday 6,0,1,2,3), 09:00–17:00 Iran time.
  await prisma.availabilityRule.createMany({
    data: [6, 0, 1, 2, 3].map((weekday) => ({
      userId: DEMO_ID,
      weekday,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    })),
  });

  console.log('✓ demo card (vaqt.me/demo)');
}

main()
  .catch((e: unknown) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
