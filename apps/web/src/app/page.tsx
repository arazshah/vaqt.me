import { Button } from '@vaqt/ui/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@vaqt/ui/components/ui/card';
import { Badge } from '@vaqt/ui/components/ui/badge';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@vaqt/ui/components/ui/tooltip';

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-brand-900">
              چند دقیقه از وقت یک آدمِ درست
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge>فوری</Badge>
              </TooltipTrigger>
              <TooltipContent>
                درخواست‌های فوری در صدر فهرست نمایش داده می‌شوند
              </TooltipContent>
            </Tooltip>
          </div>
          <CardDescription>
            بازار دقیقه‌های انسانی، بدون واسطه در معامله
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">شماره موبایل</Label>
            <Input id="phone" type="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" />
          </div>
          <Button className="w-full">شروع کنید</Button>
          <p className="text-center text-sm text-text-muted">
            فاز ۴ — سیستم طراحی (Tailwind + Vazirmatn + shadcn/ui)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
