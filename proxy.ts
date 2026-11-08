import { NextResponse, type NextRequest } from "next/server";
import { isAuthEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Route gate. Every page (and every Server Action POST) requires a valid signed session
 * cookie issued by the /login form (APP_USERNAME / APP_PASSWORD, default admin / 123123).
 */
export async function proxy(request: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await verifySessionToken(token);

  if (pathname === "/login") {
    return authenticated ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (authenticated) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};
