import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getRequestedRole, initializeUserProfile, type UserRole } from "@/lib/supabase/profile";

const roleCookieName = "vidyasetu_oauth_role";

function clearOAuthContext(response: NextResponse) {
  response.cookies.delete(roleCookieName);
}

function redirectToLogin(request: NextRequest, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  clearOAuthContext(response);
  return response;
}

export async function GET(request: NextRequest) {
  const providerError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (providerError) {
    return redirectToLogin(request, "oauth_cancelled");
  }

  if (!code && !tokenHash) {
    return redirectToLogin(request, "oauth_missing_code");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return redirectToLogin(request, "oauth_configuration_error");
  }

  const nextPath = request.nextUrl.searchParams.get("next") === "/reset-password" ? "/reset-password" : "/dashboard";
  const response = NextResponse.redirect(new URL(nextPath, request.url));
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  const authResult = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
      type: type === "recovery" ? "recovery" : "signup",
      token_hash: tokenHash as string
    });
  const { data, error } = authResult;

  if (error || !data.user) {
    return redirectToLogin(request, "oauth_exchange_failed");
  }

  const selectedRole: UserRole = request.cookies.get(roleCookieName)?.value === "teacher"
    ? "teacher"
    : getRequestedRole(data.user);

  try {
    await initializeUserProfile(supabase, data.user, selectedRole);
  } catch {
    await supabase.auth.signOut();
    response.headers.set("location", new URL("/login?error=profile_setup_failed", request.url).toString());
    clearOAuthContext(response);
    return response;
  }

  clearOAuthContext(response);
  return response;
}
