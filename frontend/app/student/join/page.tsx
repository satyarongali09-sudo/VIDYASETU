import { AuthenticatedShell } from "@/components/authenticated-shell";
import { JoinClassroomForm } from "@/components/join-classroom-form";
import { PageHeader } from "@/components/page-header";

export default function StudentJoinPage() {
  return (
    <AuthenticatedShell requiredRole="student">
      <PageHeader
        eyebrow="Student"
        title="Join class"
        description="Enter the classroom code shared by your teacher."
      />
      <JoinClassroomForm />
    </AuthenticatedShell>
  );
}
