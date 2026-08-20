// Database seeding script — Phase 1
//
// Every row uses a fixed, hand-picked id and is written via upsert, so
// running `pnpm db:seed` any number of times converges on the same state
// instead of erroring or duplicating rows.

import { prisma } from './index';
import {
  RoleIntent,
  RequestMode,
  RequestStatus,
  OfferStatus,
  ConversationStatus,
  MessageType,
  ProductCode,
  normalizeFa,
} from '@vaqt/shared';

const now = new Date();
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

const SYSTEM_SELECTION_MESSAGE =
  'توافق نهایی زمان، مدت و پرداخت مستقیماً بین شما دو نفر انجام می‌شود؛ Vaqt.me در معامله دخالتی ندارد.';

// ---------------------------------------------------------------------------
// Users — 4 seekers, 4 providers with full profiles
// ---------------------------------------------------------------------------

const users = [
  {
    id: 'usr-seeker-1',
    phone: '09120000001',
    displayName: 'امیرحسین رضایی',
    roleIntent: RoleIntent.SEEKER,
    phoneVerifiedAt: daysAgo(30),
    bio: null,
  },
  {
    id: 'usr-seeker-2',
    phone: '09120000002',
    displayName: 'اکرم موسوی',
    roleIntent: RoleIntent.SEEKER,
    phoneVerifiedAt: daysAgo(20),
    bio: null,
  },
  {
    id: 'usr-seeker-3',
    phone: '09120000003',
    displayName: 'سارا کریمی',
    roleIntent: RoleIntent.SEEKER,
    phoneVerifiedAt: null,
    bio: null,
  },
  {
    id: 'usr-seeker-4',
    phone: '09120000004',
    displayName: 'محمد طاهری',
    roleIntent: RoleIntent.SEEKER,
    phoneVerifiedAt: daysAgo(10),
    bio: null,
  },
  {
    id: 'usr-provider-1',
    phone: '09120000005',
    displayName: 'دکتر رضا احمدی',
    roleIntent: RoleIntent.PROVIDER,
    phoneVerifiedAt: daysAgo(60),
    bio: 'دکترای علوم اجتماعی، ۸ سال سابقه راهنمایی پایان‌نامه',
  },
  {
    id: 'usr-provider-2',
    phone: '09120000006',
    displayName: 'مهندس نگار صادقی',
    roleIntent: RoleIntent.PROVIDER,
    phoneVerifiedAt: daysAgo(45),
    bio: 'توسعه‌دهنده ارشد وب، متخصص React و Node.js',
  },
  {
    id: 'usr-provider-3',
    phone: '09120000007',
    displayName: 'بهنام یوسفی',
    roleIntent: RoleIntent.PROVIDER,
    phoneVerifiedAt: daysAgo(90),
    bio: 'کارشناس حقوقی، مشاور قراردادهای تجاری',
  },
  {
    id: 'usr-provider-4',
    phone: '09120000008',
    displayName: 'دکتر مریم حسینی',
    roleIntent: RoleIntent.PROVIDER,
    phoneVerifiedAt: daysAgo(15),
    bio: 'پزشک عمومی، مشاور سلامت آنلاین',
  },
];

// ---------------------------------------------------------------------------
// Categories — two-level tree, 7 top-level + 5 children = 12
// ---------------------------------------------------------------------------

const categories = [
  {
    id: 'cat-academic',
    slug: 'academic',
    name: 'دانشگاهی',
    parentId: null,
    order: 1,
  },
  {
    id: 'cat-thesis-review',
    slug: 'thesis-review',
    name: 'بازبینی پایان‌نامه',
    parentId: 'cat-academic',
    order: 1,
  },
  {
    id: 'cat-paper-prep',
    slug: 'paper-prep',
    name: 'آماده‌سازی مقاله',
    parentId: 'cat-academic',
    order: 2,
  },
  {
    id: 'cat-programming',
    slug: 'programming',
    name: 'برنامه‌نویسی',
    parentId: null,
    order: 2,
  },
  {
    id: 'cat-web-dev',
    slug: 'web-dev',
    name: 'توسعه وب',
    parentId: 'cat-programming',
    order: 1,
  },
  {
    id: 'cat-mobile-dev',
    slug: 'mobile-dev',
    name: 'توسعه موبایل',
    parentId: 'cat-programming',
    order: 2,
  },
  {
    id: 'cat-business',
    slug: 'business',
    name: 'کسب‌وکار',
    parentId: null,
    order: 3,
  },
  {
    id: 'cat-immigration',
    slug: 'immigration',
    name: 'مهاجرت',
    parentId: null,
    order: 4,
  },
  { id: 'cat-design', slug: 'design', name: 'طراحی', parentId: null, order: 5 },
  {
    id: 'cat-graphic-design',
    slug: 'graphic-design',
    name: 'طراحی گرافیک',
    parentId: 'cat-design',
    order: 1,
  },
  { id: 'cat-legal', slug: 'legal', name: 'حقوقی', parentId: null, order: 6 },
  { id: 'cat-health', slug: 'health', name: 'سلامت', parentId: null, order: 7 },
];

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

const skills = [
  {
    id: 'skill-research-method',
    slug: 'research-methodology',
    name: 'روش‌شناسی تحقیق',
    categoryId: 'cat-academic',
  },
  {
    id: 'skill-academic-editing',
    slug: 'academic-editing',
    name: 'ویرایش علمی',
    categoryId: 'cat-academic',
  },
  {
    id: 'skill-python',
    slug: 'python',
    name: 'پایتون',
    categoryId: 'cat-programming',
  },
  {
    id: 'skill-javascript',
    slug: 'javascript',
    name: 'جاوااسکریپت',
    categoryId: 'cat-web-dev',
  },
  {
    id: 'skill-react',
    slug: 'react',
    name: 'ری‌اکت',
    categoryId: 'cat-web-dev',
  },
  {
    id: 'skill-ios',
    slug: 'ios-development',
    name: 'توسعه iOS',
    categoryId: 'cat-mobile-dev',
  },
  {
    id: 'skill-android',
    slug: 'android-development',
    name: 'توسعه اندروید',
    categoryId: 'cat-mobile-dev',
  },
  {
    id: 'skill-resume',
    slug: 'resume-writing',
    name: 'نگارش رزومه',
    categoryId: 'cat-business',
  },
  {
    id: 'skill-interview-coach',
    slug: 'interview-coaching',
    name: 'آماده‌سازی مصاحبه شغلی',
    categoryId: 'cat-business',
  },
  {
    id: 'skill-visa-consult',
    slug: 'visa-consulting',
    name: 'مشاوره ویزا',
    categoryId: 'cat-immigration',
  },
  {
    id: 'skill-ui-design',
    slug: 'ui-design',
    name: 'طراحی رابط کاربری',
    categoryId: 'cat-graphic-design',
  },
  {
    id: 'skill-contract-review',
    slug: 'contract-review',
    name: 'بازبینی قرارداد',
    categoryId: 'cat-legal',
  },
];

// ---------------------------------------------------------------------------
// Requests — 15 across every status, incl. one urgent, one featured, and
// one whose description deliberately uses Arabic Yeh (ي) instead of
// Persian Yeh (ی) to exercise normalizeFa() in search.
// ---------------------------------------------------------------------------

const preferredWindowsA = [{ day: 'شنبه', start: '18:00', end: '20:00' }];
const preferredWindowsB = [{ day: 'هرروز', start: '19:00', end: '22:00' }];

interface RequestSeed {
  id: string;
  slug: string;
  ownerId: string;
  title: string;
  description: string;
  categoryId: string;
  skillIds: string[];
  mode: RequestMode;
  city: string | null;
  durationMinutes: number;
  budgetMin: number;
  budgetMax: number;
  deadlineAt: Date;
  status: RequestStatus;
  isUrgent: boolean;
  isFeatured: boolean;
  publishedAt: Date | null;
}

const requests: RequestSeed[] = [
  {
    id: 'req-thesis-review',
    slug: 'thesis-methodology-review',
    ownerId: 'usr-seeker-1',
    title: 'بازبینی روش‌شناسی پایان‌نامه علوم اجتماعی',
    description:
      'برای فصل روش‌شناسی پایان‌نامه کارشناسی ارشد جامعه‌شناسی نیاز به بازبینی دقیق دارم. ضرب‌الاجل نزدیک است و به کمک فوری نیاز دارم.',
    categoryId: 'cat-thesis-review',
    skillIds: ['skill-research-method'],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 60,
    budgetMin: 300000,
    budgetMax: 600000,
    deadlineAt: daysFromNow(2),
    status: RequestStatus.PUBLISHED,
    isUrgent: true,
    isFeatured: false,
    publishedAt: daysAgo(1),
  },
  {
    id: 'req-resume-phd',
    slug: 'resume-review-phd-application',
    ownerId: 'usr-seeker-2',
    title: 'تصحیح رزومه برای موقعیت دکترا',
    description:
      'رزومه آکادمیک برای اپلای دکترا در دانشگاه‌های اروپا آماده کرده‌ام و نیاز به بازخورد حرفه‌ای دارم.',
    categoryId: 'cat-business',
    skillIds: ['skill-resume'],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 45,
    budgetMin: 200000,
    budgetMax: 400000,
    deadlineAt: daysFromNow(5),
    status: RequestStatus.PUBLISHED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(2),
  },
  {
    id: 'req-python-consult',
    slug: 'python-coding-mentorship',
    ownerId: 'usr-seeker-3',
    title: 'مشاوره کدنویسی پایتون',
    description:
      'در حال یادگیری پایتون برای تحلیل داده هستم و به یک منتور برای رفع اشکال کد نیاز دارم.',
    categoryId: 'cat-programming',
    skillIds: ['skill-python'],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 90,
    budgetMin: 400000,
    budgetMax: 800000,
    deadlineAt: daysFromNow(7),
    status: RequestStatus.PUBLISHED,
    isUrgent: false,
    isFeatured: true,
    publishedAt: daysAgo(3),
  },
  {
    id: 'req-interview-practice',
    slug: 'job-interview-practice-session',
    ownerId: 'usr-seeker-4',
    title: 'تمرین مصاحبه شغلی',
    description:
      'برای مصاحبه استخدامی یک شرکت فناوری نیاز به تمرین مصاحبه شبیه‌سازی‌شده دارم.',
    categoryId: 'cat-business',
    skillIds: ['skill-interview-coach'],
    mode: RequestMode.IN_PERSON,
    city: 'تهران',
    durationMinutes: 60,
    budgetMin: 250000,
    budgetMax: 500000,
    deadlineAt: daysFromNow(4),
    status: RequestStatus.PUBLISHED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(1),
  },
  {
    id: 'req-thesis-literature',
    slug: 'thesis-literature-review',
    ownerId: 'usr-seeker-1',
    title: 'بازبینی ادبیات پژوهش پایان‌نامه',
    // Deliberately spelled with Arabic Yeh (ي) instead of Persian Yeh
    // (ی) in "بازنویسي" — a common real-world OCR/typo artifact —
    // to give normalizeFa() something real to normalize for search.
    description: 'به کمک برای بازنویسي بخش ادبیات پژوهش نیاز دارم.',
    categoryId: 'cat-thesis-review',
    skillIds: ['skill-academic-editing'],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 60,
    budgetMin: 300000,
    budgetMax: 550000,
    deadlineAt: daysFromNow(6),
    status: RequestStatus.PUBLISHED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(1),
  },
  {
    id: 'req-visa-consult',
    slug: 'canada-study-visa-consult',
    ownerId: 'usr-seeker-2',
    title: 'مشاوره ویزای تحصیلی کانادا',
    description:
      'قصد دارم برای برنامه کارشناسی ارشد در کانادا اقدام کنم و به مشاوره ویزای تحصیلی نیاز دارم.',
    categoryId: 'cat-immigration',
    skillIds: ['skill-visa-consult'],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 45,
    budgetMin: 350000,
    budgetMax: 700000,
    deadlineAt: daysFromNow(3),
    status: RequestStatus.PUBLISHED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(2),
  },
  {
    id: 'req-ui-review',
    slug: 'app-ui-design-review',
    ownerId: 'usr-seeker-3',
    title: 'بازبینی طراحی رابط کاربری اپلیکیشن',
    description:
      'یک اپلیکیشن موبایل طراحی کرده‌ام و نیاز به بازخورد یک طراح باتجربه درباره تجربه کاربری دارم.',
    categoryId: 'cat-graphic-design',
    skillIds: ['skill-ui-design'],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 60,
    budgetMin: 400000,
    budgetMax: 900000,
    deadlineAt: daysFromNow(5),
    status: RequestStatus.PUBLISHED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(1),
  },
  {
    id: 'req-web-mentor',
    slug: 'react-project-mentorship',
    ownerId: 'usr-seeker-4',
    title: 'راهنمایی پروژه شخصی React',
    description:
      'در حال ساخت یک پروژه شخصی با React هستم و برای دو ساعت نیاز به راهنمایی یک توسعه‌دهنده باتجربه دارم.',
    categoryId: 'cat-web-dev',
    skillIds: ['skill-javascript', 'skill-react'],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 120,
    budgetMin: 500000,
    budgetMax: 900000,
    deadlineAt: daysAgo(1),
    status: RequestStatus.OFFER_SELECTED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(5),
  },
  {
    id: 'req-contract-review',
    slug: 'freelance-contract-legal-review',
    ownerId: 'usr-seeker-1',
    title: 'بازبینی قرارداد همکاری فریلنسری',
    description:
      'یک قرارداد همکاری با یک شرکت خارجی دریافت کرده‌ام و نیاز به بررسی حقوقی قبل از امضا دارم.',
    categoryId: 'cat-legal',
    skillIds: ['skill-contract-review'],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 45,
    budgetMin: 300000,
    budgetMax: 600000,
    deadlineAt: daysAgo(2),
    status: RequestStatus.OFFER_SELECTED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(6),
  },
  {
    id: 'req-business-plan',
    slug: 'startup-business-plan-review',
    ownerId: 'usr-seeker-2',
    title: 'بازبینی طرح کسب‌وکار استارتاپ',
    description:
      'طرح کسب‌وکار یک استارتاپ کوچک را نوشته‌ام و می‌خواهم قبل از ارائه به سرمایه‌گذار آن را بررسی کنم.',
    categoryId: 'cat-business',
    skillIds: [],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 60,
    budgetMin: 400000,
    budgetMax: 800000,
    deadlineAt: daysAgo(10),
    status: RequestStatus.CLOSED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(20),
  },
  {
    id: 'req-mobile-app-review',
    slug: 'android-app-code-review',
    ownerId: 'usr-seeker-3',
    title: 'بازبینی کد اپلیکیشن اندروید',
    description:
      'یک اپلیکیشن اندروید ساده نوشته‌ام و می‌خواهم کد آن را یک توسعه‌دهنده باتجربه بازبینی کند.',
    categoryId: 'cat-mobile-dev',
    skillIds: ['skill-android'],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 60,
    budgetMin: 350000,
    budgetMax: 650000,
    deadlineAt: daysAgo(15),
    status: RequestStatus.EXPIRED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(25),
  },
  {
    id: 'req-health-consult',
    slug: 'weight-loss-nutrition-consult',
    ownerId: 'usr-seeker-4',
    title: 'مشاوره تغذیه برای کاهش وزن',
    description:
      'به دنبال یک برنامه تغذیه اصولی برای کاهش وزن تدریجی هستم و نیاز به مشاوره اولیه دارم.',
    categoryId: 'cat-health',
    skillIds: [],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 30,
    budgetMin: 150000,
    budgetMax: 300000,
    deadlineAt: daysAgo(8),
    status: RequestStatus.EXPIRED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(18),
  },
  {
    id: 'req-removed-example',
    slug: 'logo-design-online-shop',
    ownerId: 'usr-seeker-1',
    title: 'طراحی لوگو برای فروشگاه آنلاین',
    description: 'این درخواست توسط کاربر حذف شده است.',
    categoryId: 'cat-design',
    skillIds: [],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 60,
    budgetMin: 200000,
    budgetMax: 400000,
    deadlineAt: daysAgo(5),
    status: RequestStatus.REMOVED,
    isUrgent: false,
    isFeatured: false,
    publishedAt: daysAgo(15),
  },
  {
    id: 'req-draft-migration',
    slug: 'draft-germany-work-migration',
    ownerId: 'usr-seeker-2',
    title: 'پیش‌نویس: مشاوره مهاجرت کاری آلمان',
    description: 'در حال تکمیل جزئیات درخواست برای مشاوره مهاجرت کاری هستم.',
    categoryId: 'cat-immigration',
    skillIds: [],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 60,
    budgetMin: 400000,
    budgetMax: 800000,
    deadlineAt: daysFromNow(14),
    status: RequestStatus.DRAFT,
    isUrgent: false,
    isFeatured: false,
    publishedAt: null,
  },
  {
    id: 'req-draft-thesis-stats',
    slug: 'draft-thesis-statistical-analysis',
    ownerId: 'usr-seeker-3',
    title: 'پیش‌نویس: تحلیل آماری داده‌های پایان‌نامه',
    description: 'هنوز جزئیات دقیق تحلیل آماری مورد نیاز را مشخص نکرده‌ام.',
    categoryId: 'cat-academic',
    skillIds: [],
    mode: RequestMode.ONLINE,
    city: null,
    durationMinutes: 90,
    budgetMin: 500000,
    budgetMax: 1000000,
    deadlineAt: daysFromNow(20),
    status: RequestStatus.DRAFT,
    isUrgent: false,
    isFeatured: false,
    publishedAt: null,
  },
];

void preferredWindowsB; // reserved for future variation; keeps both windows defined

// ---------------------------------------------------------------------------
// Offers — 20 total, spread across published/selected/closed/expired requests
// ---------------------------------------------------------------------------

interface OfferSeed {
  id: string;
  requestId: string;
  providerId: string;
  status: OfferStatus;
  price: number;
  proposedStartAt: Date;
  proposedDurationMinutes: number;
  message: string;
}

const offers: OfferSeed[] = [
  {
    id: 'offer-web-mentor-1',
    requestId: 'req-web-mentor',
    providerId: 'usr-provider-2',
    status: OfferStatus.SELECTED,
    price: 700000,
    proposedStartAt: daysFromNow(1),
    proposedDurationMinutes: 120,
    message: 'خوشحال می‌شوم کمک کنم، پروژه‌های مشابه زیادی راهنمایی کرده‌ام.',
  },
  {
    id: 'offer-web-mentor-2',
    requestId: 'req-web-mentor',
    providerId: 'usr-provider-1',
    status: OfferStatus.REJECTED,
    price: 650000,
    proposedStartAt: daysFromNow(2),
    proposedDurationMinutes: 120,
    message: 'می‌توانم کمک کنم.',
  },
  {
    id: 'offer-web-mentor-3',
    requestId: 'req-web-mentor',
    providerId: 'usr-provider-4',
    status: OfferStatus.REJECTED,
    price: 750000,
    proposedStartAt: daysFromNow(1),
    proposedDurationMinutes: 120,
    message: 'تجربه کاری با React دارم.',
  },
  {
    id: 'offer-contract-1',
    requestId: 'req-contract-review',
    providerId: 'usr-provider-3',
    status: OfferStatus.SELECTED,
    price: 450000,
    proposedStartAt: daysFromNow(1),
    proposedDurationMinutes: 45,
    message: 'می‌توانم امروز بررسی را انجام دهم.',
  },
  {
    id: 'offer-contract-2',
    requestId: 'req-contract-review',
    providerId: 'usr-provider-1',
    status: OfferStatus.REJECTED,
    price: 500000,
    proposedStartAt: daysFromNow(2),
    proposedDurationMinutes: 45,
    message: 'در حوزه قراردادهای بین‌المللی تجربه دارم.',
  },
  {
    id: 'offer-thesis-review-1',
    requestId: 'req-thesis-review',
    providerId: 'usr-provider-1',
    status: OfferStatus.PENDING,
    price: 450000,
    proposedStartAt: daysFromNow(2),
    proposedDurationMinutes: 60,
    message: 'در زمینه روش‌شناسی تحقیق تخصص دارم.',
  },
  {
    id: 'offer-thesis-review-2',
    requestId: 'req-thesis-review',
    providerId: 'usr-provider-4',
    status: OfferStatus.PENDING,
    price: 470000,
    proposedStartAt: daysFromNow(2),
    proposedDurationMinutes: 60,
    message: 'می‌توانم به سرعت کمک کنم.',
  },
  {
    id: 'offer-resume-phd-1',
    requestId: 'req-resume-phd',
    providerId: 'usr-provider-3',
    status: OfferStatus.PENDING,
    price: 250000,
    proposedStartAt: daysFromNow(3),
    proposedDurationMinutes: 45,
    message: 'رزومه‌های آکادمیک زیادی بازبینی کرده‌ام.',
  },
  {
    id: 'offer-resume-phd-2',
    requestId: 'req-resume-phd',
    providerId: 'usr-provider-2',
    status: OfferStatus.PENDING,
    price: 300000,
    proposedStartAt: daysFromNow(4),
    proposedDurationMinutes: 45,
    message: 'می‌توانم بازخورد دقیقی بدهم.',
  },
  {
    id: 'offer-python-consult-1',
    requestId: 'req-python-consult',
    providerId: 'usr-provider-2',
    status: OfferStatus.PENDING,
    price: 600000,
    proposedStartAt: daysFromNow(3),
    proposedDurationMinutes: 90,
    message: 'در تحلیل داده با پایتون تجربه زیادی دارم.',
  },
  {
    id: 'offer-python-consult-2',
    requestId: 'req-python-consult',
    providerId: 'usr-provider-1',
    status: OfferStatus.PENDING,
    price: 550000,
    proposedStartAt: daysFromNow(4),
    proposedDurationMinutes: 90,
    message: 'در تدریس پایتون هم تجربه دارم.',
  },
  {
    id: 'offer-interview-practice-1',
    requestId: 'req-interview-practice',
    providerId: 'usr-provider-3',
    status: OfferStatus.PENDING,
    price: 350000,
    proposedStartAt: daysFromNow(3),
    proposedDurationMinutes: 60,
    message: 'می‌توانم مصاحبه شبیه‌سازی‌شده برگزار کنم.',
  },
  {
    id: 'offer-thesis-literature-1',
    requestId: 'req-thesis-literature',
    providerId: 'usr-provider-1',
    status: OfferStatus.PENDING,
    price: 400000,
    proposedStartAt: daysFromNow(4),
    proposedDurationMinutes: 60,
    message: 'در بازبینی ادبیات پژوهش تخصص دارم.',
  },
  {
    id: 'offer-visa-consult-1',
    requestId: 'req-visa-consult',
    providerId: 'usr-provider-3',
    status: OfferStatus.PENDING,
    price: 500000,
    proposedStartAt: daysFromNow(2),
    proposedDurationMinutes: 45,
    message: 'با فرآیند ویزای تحصیلی کانادا آشنا هستم.',
  },
  {
    id: 'offer-visa-consult-2',
    requestId: 'req-visa-consult',
    providerId: 'usr-provider-4',
    status: OfferStatus.PENDING,
    price: 480000,
    proposedStartAt: daysFromNow(3),
    proposedDurationMinutes: 45,
    message: 'می‌توانم مشاوره اولیه بدهم.',
  },
  {
    id: 'offer-ui-review-1',
    requestId: 'req-ui-review',
    providerId: 'usr-provider-2',
    status: OfferStatus.PENDING,
    price: 600000,
    proposedStartAt: daysFromNow(2),
    proposedDurationMinutes: 60,
    message: 'در طراحی تجربه کاربری اپلیکیشن تجربه دارم.',
  },
  {
    id: 'offer-ui-review-2',
    requestId: 'req-ui-review',
    providerId: 'usr-provider-4',
    status: OfferStatus.PENDING,
    price: 650000,
    proposedStartAt: daysFromNow(3),
    proposedDurationMinutes: 60,
    message: 'می‌توانم بازخورد کاربردی بدهم.',
  },
  {
    id: 'offer-business-plan-1',
    requestId: 'req-business-plan',
    providerId: 'usr-provider-3',
    status: OfferStatus.PENDING,
    price: 500000,
    proposedStartAt: daysAgo(9),
    proposedDurationMinutes: 60,
    message: 'در بررسی طرح‌های کسب‌وکار تجربه دارم.',
  },
  {
    id: 'offer-mobile-app-review-1',
    requestId: 'req-mobile-app-review',
    providerId: 'usr-provider-2',
    status: OfferStatus.EXPIRED,
    price: 400000,
    proposedStartAt: daysAgo(14),
    proposedDurationMinutes: 60,
    message: 'می‌توانم کد را بازبینی کنم.',
  },
  {
    id: 'offer-health-consult-1',
    requestId: 'req-health-consult',
    providerId: 'usr-provider-4',
    status: OfferStatus.EXPIRED,
    price: 180000,
    proposedStartAt: daysAgo(7),
    proposedDurationMinutes: 30,
    message: 'می‌توانم یک برنامه تغذیه اولیه ارائه دهم.',
  },
];

// ---------------------------------------------------------------------------
// Conversations + messages — 2 active conversations from the 2 SELECTED offers
// ---------------------------------------------------------------------------

const conversations = [
  {
    id: 'conv-web-mentor',
    requestId: 'req-web-mentor',
    offerId: 'offer-web-mentor-1',
    seekerId: 'usr-seeker-4',
    providerId: 'usr-provider-2',
    status: ConversationStatus.OPEN,
    messages: [
      {
        id: 'msg-web-mentor-1',
        senderId: null,
        type: MessageType.SYSTEM,
        body: SYSTEM_SELECTION_MESSAGE,
        at: daysAgo(1),
      },
      {
        id: 'msg-web-mentor-2',
        senderId: 'usr-seeker-4',
        type: MessageType.TEXT,
        body: 'سلام، خیلی ممنون که پیشنهادم رو قبول کردید. کی می‌تونیم شروع کنیم؟',
        at: daysAgo(1),
      },
      {
        id: 'msg-web-mentor-3',
        senderId: 'usr-provider-2',
        type: MessageType.TEXT,
        body: 'سلام! خواهش می‌کنم. فردا ساعت ۱۸ وقت دارم، مناسبه؟',
        at: daysAgo(0),
      },
    ],
  },
  {
    id: 'conv-contract-review',
    requestId: 'req-contract-review',
    offerId: 'offer-contract-1',
    seekerId: 'usr-seeker-1',
    providerId: 'usr-provider-3',
    status: ConversationStatus.OPEN,
    messages: [
      {
        id: 'msg-contract-1',
        senderId: null,
        type: MessageType.SYSTEM,
        body: SYSTEM_SELECTION_MESSAGE,
        at: daysAgo(2),
      },
      {
        id: 'msg-contract-2',
        senderId: 'usr-seeker-1',
        type: MessageType.TEXT,
        body: 'سلام، قرارداد رو براتون ایمیل کردم. لطفاً وقتی فرصت داشتید بررسی کنید.',
        at: daysAgo(2),
      },
      {
        id: 'msg-contract-3',
        senderId: 'usr-provider-3',
        type: MessageType.TEXT,
        body: 'سلام، دریافت شد. تا فردا ظهر نتیجه بررسی رو اعلام می‌کنم.',
        at: daysAgo(1),
      },
    ],
  },
];

const reviews = [
  {
    id: 'review-web-mentor',
    conversationId: 'conv-web-mentor',
    reviewerId: 'usr-seeker-4',
    revieweeId: 'usr-provider-2',
    rating: 5,
    comment: 'راهنمایی فوق‌العاده‌ای بود، خیلی کمکم کرد.',
  },
  {
    id: 'review-contract-review',
    conversationId: 'conv-contract-review',
    reviewerId: 'usr-seeker-1',
    revieweeId: 'usr-provider-3',
    rating: 4,
    comment: 'بررسی دقیق و به‌موقع بود.',
  },
];

// ---------------------------------------------------------------------------
// Products — the 5 upgrade catalog entries
// ---------------------------------------------------------------------------

const products = [
  {
    id: 'prod-urgent-badge',
    code: ProductCode.URGENT_BADGE,
    title: 'نشان فوری',
    description: 'درخواست شما با بج نارنجی «فوری» در فهرست برجسته می‌شود.',
    priceIRT: 49000,
    durationHours: 72,
  },
  {
    id: 'prod-bump',
    code: ProductCode.BUMP,
    title: 'نردبان',
    description: 'درخواست شما به‌صورت دوره‌ای به بالای فهرست بازمی‌گردد.',
    priceIRT: 39000,
    durationHours: 48,
  },
  {
    id: 'prod-feature',
    code: ProductCode.FEATURE,
    title: 'برجسته‌سازی',
    description:
      'درخواست شما با بج بنفش «ارتقایافته» و اولویت نمایش بالاتر دیده می‌شود.',
    priceIRT: 79000,
    durationHours: 168,
  },
  {
    id: 'prod-pro-monthly',
    code: ProductCode.PRO_MONTHLY,
    title: 'اشتراک حرفه‌ای ماهانه',
    description:
      'ارسال پیشنهاد نامحدود و دسترسی به امکانات ویژه ارائه‌دهندگان حرفه‌ای.',
    priceIRT: 299000,
    durationHours: 720,
  },
  {
    id: 'prod-targeted-notify',
    code: ProductCode.TARGETED_NOTIFY,
    title: 'اعلان هدفمند',
    description:
      'ارسال اعلان به ارائه‌دهندگان مرتبط با حوزه و شهر درخواست شما.',
    priceIRT: 59000,
    durationHours: null,
  },
];

// ---------------------------------------------------------------------------

function listTierFor(
  request: Pick<RequestSeed, 'isFeatured' | 'isUrgent'>,
): number {
  if (request.isFeatured) return 2;
  if (request.isUrgent) return 1;
  return 0;
}

async function main() {
  console.log('Seeding database...');

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: user,
      update: user,
    });
  }
  console.log(`✓ ${String(users.length)} users`);

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      create: category,
      update: category,
    });
  }
  console.log(`✓ ${String(categories.length)} categories`);

  for (const skill of skills) {
    await prisma.skill.upsert({
      where: { id: skill.id },
      create: skill,
      update: skill,
    });
  }
  console.log(`✓ ${String(skills.length)} skills`);

  for (const request of requests) {
    const { skillIds, ...rest } = request;
    const searchText = normalizeFa(`${rest.title} ${rest.description}`);
    const data = {
      ...rest,
      preferredWindows:
        listTierFor(rest) > 0 ? preferredWindowsA : preferredWindowsB,
      searchText,
      listTier: listTierFor(rest),
      listRankAt: rest.publishedAt ?? now,
    };
    await prisma.request.upsert({
      where: { id: request.id },
      create: data,
      update: data,
    });

    for (const skillId of skillIds) {
      await prisma.requestSkill.upsert({
        where: { requestId_skillId: { requestId: request.id, skillId } },
        create: { requestId: request.id, skillId },
        update: {},
      });
    }
  }
  console.log(`✓ ${String(requests.length)} requests`);

  for (const offer of offers) {
    await prisma.offer.upsert({
      where: { id: offer.id },
      create: offer,
      update: offer,
    });
  }
  console.log(`✓ ${String(offers.length)} offers`);

  for (const conversation of conversations) {
    const { messages, ...rest } = conversation;
    const lastMessageAt = messages[messages.length - 1]?.at ?? now;
    await prisma.conversation.upsert({
      where: { id: conversation.id },
      create: { ...rest, lastMessageAt },
      update: { ...rest, lastMessageAt },
    });

    for (const message of messages) {
      await prisma.message.upsert({
        where: { id: message.id },
        create: {
          id: message.id,
          conversationId: conversation.id,
          senderId: message.senderId,
          type: message.type,
          body: message.body,
          createdAt: message.at,
        },
        update: {
          senderId: message.senderId,
          type: message.type,
          body: message.body,
        },
      });
    }
  }
  console.log(`✓ ${String(conversations.length)} conversations with messages`);

  for (const review of reviews) {
    await prisma.review.upsert({
      where: { id: review.id },
      create: review,
      update: review,
    });
  }
  console.log(`✓ ${String(reviews.length)} reviews`);

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      create: product,
      update: product,
    });
  }
  console.log(`✓ ${String(products.length)} products`);

  console.log('✓ Database seeding complete');
}

main()
  .catch((e: unknown) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
