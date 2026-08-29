import type { SupabaseClient } from "@supabase/supabase-js";

export function subscribeToClassroomEvents(
  supabase: SupabaseClient,
  classroomId: string,
  onEvent: (payload: unknown) => void
) {
  const channel = supabase
    .channel(`classroom:${classroomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "live_events",
        filter: `classroom_id=eq.${classroomId}`
      },
      onEvent
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
