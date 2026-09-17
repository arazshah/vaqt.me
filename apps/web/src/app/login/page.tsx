import { KeyRound } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@vaqt/ui/components/ui/card';

import { AppShell } from '@/components/app-shell';
import { OtpForm } from '@/components/domain/otp-form';
import { fa } from '@/messages/fa';

export default function LoginPage() {
  return (
    <AppShell>
      <div className="flex min-h-[60vh] items-center justify-center py-8">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader className="items-center text-center">
              <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="size-6 text-primary" aria-hidden="true" />
              </span>
              <CardTitle className="text-xl">{fa.loginPage.title}</CardTitle>
              <CardDescription>{fa.loginPage.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <OtpForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
