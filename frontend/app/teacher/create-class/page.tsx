import { AuthenticatedShell } from "@/components/authenticated-shell";
import { CreateClassroomForm } from "@/components/create-classroom-form";
import { PageHeader } from "@/components/page-header";

export default function CreateClassPage() {
  return (
    <AuthenticatedShell requiredRole="teacher">
      <PageHeader
        eyebrow="Teacher"
        title="Create class"
        description="Set the classroom name, subject, and description."
      />
      <CreateClassroomForm />
    </AuthenticatedShell>
  );
}
