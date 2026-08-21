import { notFound } from 'next/navigation';
import type { RequestStatus } from '@vaqt/shared';
import { Button } from '@vaqt/ui/components/ui/button';
import { Badge } from '@vaqt/ui/components/ui/badge';
import { Label } from '@vaqt/ui/components/ui/label';
import { Textarea } from '@vaqt/ui/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vaqt/ui/components/ui/select';
import { Checkbox } from '@vaqt/ui/components/ui/checkbox';
import { Switch } from '@vaqt/ui/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@vaqt/ui/components/ui/radio-group';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
} from '@vaqt/ui/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@vaqt/ui/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@vaqt/ui/components/ui/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@vaqt/ui/components/ui/tabs';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@vaqt/ui/components/ui/pagination';
import { Spinner } from '@vaqt/ui/components/ui/spinner';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@vaqt/ui/components/ui/empty';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';
import { Separator } from '@vaqt/ui/components/ui/separator';
import { PriceTag } from '@vaqt/ui/components/price-tag';
import { BidiInput } from '@vaqt/ui/components/bidi-input';

import { AppShell } from '@/components/app-shell';
import {
  RequestCard,
  type RequestCardData,
} from '@/components/domain/request-card';
import { fa } from '@/messages/fa';

const MOCK_REQUESTS: RequestCardData[] = [
  {
    id: 'req-1',
    title: 'بازبینی فصل ادبیات پایان‌نامه',
    categoryName: 'بازبینی پایان‌نامه',
    city: 'تهران',
    mode: 'ONLINE',
    status: 'PUBLISHED',
    offerCount: 4,
    ownerDisplayName: 'کاربر ۴۵۶۷',
    budgetMinRial: 3000000,
    budgetMaxRial: 6000000,
  },
  {
    id: 'req-2',
    title: 'مشاوره‌ی معماری فرانت‌اند',
    categoryName: 'توسعه وب',
    city: null,
    mode: 'HYBRID',
    status: 'OFFER_SELECTED',
    offerCount: 7,
    ownerDisplayName: 'مریم رضایی',
    // Budget hidden: guest / phone-unverified viewer (bond 6).
    budgetMinRial: null,
    budgetMaxRial: null,
  },
  {
    id: 'req-3',
    title: 'ترجمه‌ی چکیده به انگلیسی',
    categoryName: 'ترجمه',
    city: 'اصفهان',
    mode: 'IN_PERSON',
    status: 'DRAFT',
    offerCount: 0,
    ownerDisplayName: 'علی محمدی',
    budgetMinRial: 500000,
    budgetMaxRial: 900000,
  },
];

const ALL_STATUSES: RequestStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'OFFER_SELECTED',
  'CLOSED',
  'EXPIRED',
  'REMOVED',
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// Component gallery for internal design-system review only — never a real
// product surface. Gated on NODE_ENV, not a public flag, so a production
// build always 404s here regardless of misconfigured env vars.
export default function DevUiGalleryPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div>
          <h1 className="text-2xl font-bold">{fa.devUi.title}</h1>
          <p className="text-sm text-muted-foreground">
            {fa.devUi.description}
          </p>
        </div>

        <Section title={fa.devUi.sections.buttons}>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
        </Section>

        <Separator />

        <Section title={fa.devUi.sections.badges}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((status) => (
                <Badge
                  key={status}
                  variant={
                    status === 'DRAFT'
                      ? 'secondary'
                      : status === 'CLOSED'
                        ? 'outline'
                        : status === 'EXPIRED' || status === 'REMOVED'
                          ? 'destructive'
                          : 'default'
                  }
                >
                  {fa.requestStatus[status]}
                </Badge>
              ))}
            </div>
          </div>
        </Section>

        <Separator />

        <Section title={fa.devUi.sections.formFields}>
          <div className="grid max-w-sm gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="dev-ui-select">
                {fa.devUi.labels.selectCategory}
              </Label>
              <Select>
                <SelectTrigger id="dev-ui-select">
                  <SelectValue
                    placeholder={fa.devUi.labels.selectCategoryPlaceholder}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thesis-review">
                    بازبینی پایان‌نامه
                  </SelectItem>
                  <SelectItem value="web-dev">توسعه وب</SelectItem>
                  <SelectItem value="translation">ترجمه</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="dev-ui-notes">{fa.devUi.labels.notes}</Label>
              <Textarea id="dev-ui-notes" rows={3} />
            </div>

            <RadioGroup defaultValue="online" className="gap-2">
              {(
                [
                  ['online', fa.requestMode.ONLINE],
                  ['in-person', fa.requestMode.IN_PERSON],
                  ['hybrid', fa.requestMode.HYBRID],
                ] as const
              ).map(([value, label]) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`dev-ui-mode-${value}`} />
                  <Label htmlFor={`dev-ui-mode-${value}`}>{label}</Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex items-center gap-2">
              <Checkbox id="dev-ui-terms" />
              <Label htmlFor="dev-ui-terms">
                {fa.devUi.labels.agreeToTerms}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="dev-ui-notify" />
              <Label htmlFor="dev-ui-notify">{fa.devUi.labels.notifyMe}</Label>
            </div>
          </div>
        </Section>

        <Separator />

        <Section title={fa.devUi.sections.bidiField}>
          <div className="grid max-w-sm gap-1.5">
            <Label htmlFor="dev-ui-phone">{fa.devUi.labels.phoneNumber}</Label>
            <BidiInput
              id="dev-ui-phone"
              inputMode="tel"
              defaultValue="+989121234567"
            />
          </div>
        </Section>

        <Separator />

        <Section title={fa.devUi.sections.price}>
          <div className="flex items-center gap-4 text-sm">
            <PriceTag rial={490000} />
            <PriceTag rial={125000000} />
            <PriceTag rial={0} />
          </div>
        </Section>

        <Separator />

        <Section title={fa.devUi.sections.avatars}>
          <AvatarGroup>
            <Avatar>
              <AvatarFallback>ع</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>م</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>ر</AvatarFallback>
            </Avatar>
          </AvatarGroup>
        </Section>

        <Separator />

        <Section title={fa.devUi.sections.cards}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MOCK_REQUESTS.map((request) => (
              <RequestCard key={request.id} data={request} />
            ))}
          </div>
        </Section>

        <Separator />

        <Section title={fa.devUi.sections.overlays}>
          <div className="flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">{fa.devUi.labels.openDialog}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{fa.devUi.labels.dialogTitle}</DialogTitle>
                  <DialogDescription>
                    {fa.devUi.labels.dialogDescription}
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">{fa.devUi.labels.openSheet}</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>{fa.devUi.labels.sheetTitle}</SheetTitle>
                  <SheetDescription>
                    {fa.devUi.labels.sheetDescription}
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          </div>
        </Section>

        <Separator />

        <Section title={fa.devUi.sections.tabs}>
          <Tabs defaultValue="one" className="max-w-md">
            <TabsList>
              <TabsTrigger value="one">Tab 1</TabsTrigger>
              <TabsTrigger value="two">Tab 2</TabsTrigger>
            </TabsList>
            <TabsContent value="one">Tab 1 content</TabsContent>
            <TabsContent value="two">Tab 2 content</TabsContent>
          </Tabs>
        </Section>

        <Separator />

        <Section title={fa.devUi.sections.pagination}>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" text="قبلی" />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>
                  ۱
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">۲</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" text="بعدی" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </Section>

        <Separator />

        <Section title={fa.devUi.sections.states}>
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Spinner />
              <span className="text-sm text-muted-foreground">
                {fa.devUi.labels.loading}
              </span>
            </div>

            <div className="flex max-w-sm flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>

            <Empty className="max-w-sm">
              <EmptyHeader>
                <EmptyTitle>{fa.devUi.labels.emptyStateTitle}</EmptyTitle>
                <EmptyDescription>
                  {fa.devUi.labels.emptyStateDescription}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
