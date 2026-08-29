import { AuthenticatedShell } from "@/components/authenticated-shell";
import { PageHeader } from "@/components/page-header";
import { ProfileSummary } from "@/components/profile-summary";

export default function ProfilePage() {
  return (
    <AuthenticatedShell>
      <PageHeader eyebrow="Account" title="Profile" description="Your VIDYASETU account details and classroom role." />
      <ProfileSummary />
    </AuthenticatedShell>
  );
}
