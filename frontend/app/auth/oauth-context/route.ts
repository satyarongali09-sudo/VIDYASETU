import { NextResponse, type NextRequest } from "next/server";

const roleCookieName = "vidyasetu_oauth_role";
const cookieLifetimeSeconds = 10 * 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { role?: unknown } | null;
  const role = body?.role === "teacher" ? "teacher" : "student";
  const response = NextResponse.json({ ok: true });
  const cookieOptions = {
    httpOnly: true,
    maxAge: cookieLifetimeSeconds,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };

  response.cookies.set(roleCookieName, role, cookieOptions);
  return response;
}
