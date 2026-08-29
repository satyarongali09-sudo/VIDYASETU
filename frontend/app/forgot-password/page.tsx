import { AppShell } from "@/components/app-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { PageHeader } from "@/components/page-header";

export default function ForgotPasswordPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Account recovery" title="Reset your password" description="Enter your email address and we will send a secure reset link." />
      <ForgotPasswordForm />
    </AppShell>
  );
}
