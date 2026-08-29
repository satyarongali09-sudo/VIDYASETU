import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";
import { PageHeader } from "@/components/page-header";

const oauthMessages: Record<string, string> = {
  oauth_cancelled: "Google Sign-In was cancelled. Please try again when you are ready.",
  oauth_missing_code: "Google sign-in could not be completed. You can sign in with email and password instead.",
  oauth_exchange_failed: "Google sign-in could not be completed. You can sign in with email and password instead.",
  profile_setup_failed: "Your account was verified, but your VIDYASETU profile could not be prepared. Please try again.",
  oauth_configuration_error: "Google Sign-In is not configured correctly. Please contact the project administrator."
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Login"
        description="Your classroom, connected."
      />
      <AuthForm initialError={error ? oauthMessages[error] ?? "Google Sign-In could not be completed. Please try again." : undefined} />
    </AppShell>
  );
}
