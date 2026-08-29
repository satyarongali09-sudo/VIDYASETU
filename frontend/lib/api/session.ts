import { createClient } from "@/lib/supabase/browser";

export async function getApiAccessToken() {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  return session.access_token;
}
