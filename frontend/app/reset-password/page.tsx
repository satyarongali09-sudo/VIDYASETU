import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Account recovery" title="Set a new password" description="Choose a new password for your VIDYASETU account." />
      <ResetPasswordForm />
    </AppShell>
  );
}
