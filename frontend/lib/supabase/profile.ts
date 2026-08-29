import type { SupabaseClient, User } from "@supabase/supabase-js";

export type UserRole = "teacher" | "student";

export type AuthenticatedUser = {
  id: string;
  email?: string;
  name: string;
  avatarUrl?: string;
};

function metadataValue(metadata: User["user_metadata"], key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function getAuthenticatedUser(user: User): AuthenticatedUser {
  const email = user.email ?? undefined;
  const name =
    metadataValue(user.user_metadata, "full_name") ??
    metadataValue(user.user_metadata, "name") ??
    email?.split("@")[0] ??
    "VIDYASETU user";
  const avatarUrl =
    metadataValue(user.user_metadata, "avatar_url") ?? metadataValue(user.user_metadata, "picture");

  return { id: user.id, email, name, avatarUrl };
}

export function getRequestedRole(user: User): UserRole {
  return user.user_metadata.vidyasetu_role === "teacher" ? "teacher" : "student";
}

export async function initializeUserProfile(
  supabase: SupabaseClient,
  user: User,
  role: UserRole
) {
  const profile = getAuthenticatedUser(user);
  const { data: existingProfile, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profile.id)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingProfile) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        email: profile.email ?? null,
        full_name: profile.name,
        avatar_url: profile.avatarUrl ?? null
      })
      .eq("id", profile.id);

    if (updateError) {
      throw updateError;
    }

    return;
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: profile.id,
    role,
    email: profile.email ?? null,
    full_name: profile.name,
    avatar_url: profile.avatarUrl ?? null
  });

  if (insertError) {
    throw insertError;
  }
}

export function getGoogleAvatarUrl(avatarUrl?: string) {
  if (!avatarUrl) {
    return undefined;
  }

  try {
    const url = new URL(avatarUrl);
    const isGoogleHost =
      url.protocol === "https:" &&
      (url.hostname === "googleusercontent.com" || url.hostname.endsWith(".googleusercontent.com"));

    return isGoogleHost ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
