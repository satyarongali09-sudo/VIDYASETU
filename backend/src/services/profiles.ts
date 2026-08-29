import { supabaseAdmin } from "./supabase.js";

export type ProfileRole = "teacher" | "student";

export async function getProfileRole(userId: string): Promise<ProfileRole | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.role === "teacher" || data?.role === "student" ? data.role : null;
}
