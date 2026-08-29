import { ActionPanel } from "@/components/action-panel";
import { AppShell } from "@/components/app-shell";
import { MetricGrid } from "@/components/metric-grid";
import { PageHeader } from "@/components/page-header";

export default function HomePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Live learning"
        title="Teach live classes with slides, audio, polls, Q&A, and attendance in one place."
        description="VIDYASETU connects teachers and students through a focused classroom workflow backed by Supabase and a dedicated backend API."
      />
      <div className="split" id="features">
        <ActionPanel
          title="Start from your role"
          description="Teachers create classrooms and sessions. Students join classrooms and participate in live sessions."
          primaryHref="/teacher/dashboard"
          primaryLabel="Teacher workspace"
          secondaryHref="/student/dashboard"
          secondaryLabel="Student workspace"
        />
        <MetricGrid
          metrics={[
            { label: "Realtime", value: "Live", detail: "Presence, polls, Q&A, and classroom events." },
            { label: "Media", value: "SFU", detail: "WebRTC/LiveKit-ready audio and video flow." },
            { label: "Data", value: "RLS", detail: "Supabase tables scoped by teacher and enrollment." }
          ]}
        />
      </div>
      <section className="section-gap" id="how-it-works">
        <PageHeader eyebrow="How it works" title="Create, join, and learn together." description="Teachers create classrooms. Students join with an invite code. Both roles work from their own secure workspace." />
      </section>
    </AppShell>
  );
}
