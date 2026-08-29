import { AppShell } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";
import { PageHeader } from "@/components/page-header";

export default function RegisterPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Register"
        description="Create an account with email and password, or continue with Google."
      />
      <AuthForm initialMode="create-account" />
    </AppShell>
  );
}
