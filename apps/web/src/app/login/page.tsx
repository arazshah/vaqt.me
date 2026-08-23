import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@vaqt/ui/components/ui/card';

import { AppShell } from '@/components/app-shell';
import { OtpForm } from '@/components/domain/otp-form';
import { fa } from '@/messages/fa';

export default function LoginPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>{fa.loginPage.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <OtpForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
