// Guards the internal team area (pages and API). Runs on the Node.js runtime
// so it can use the same constant-time comparison as the route handlers.
import { NextResponse, type NextRequest } from "next/server";
import { checkInternalAuth } from "@/lib/internal-auth";

export const config = {
  matcher: ["/internal/:path*", "/api/internal/:path*"],
  runtime: "nodejs",
};

export function middleware(req: NextRequest) {
  const auth = checkInternalAuth(req.headers.get("authorization"));
  if (auth.ok) return NextResponse.next();
  if (auth.status === 503) {
    return new NextResponse("Internal area disabled: set INTERNAL_USER and INTERNAL_PASSWORD (12+ chars).", {
      status: 503,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Book a Carnival internal", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" },
  });
}
