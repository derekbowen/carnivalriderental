import { NextResponse, type NextRequest } from "next/server";
import { checkInternalAuth, checkSiteAccess } from "./lib/auth";

const isInternal = (p: string) => p === "/internal" || p.startsWith("/internal/") || p.startsWith("/api/internal/");

function indexingAllowed(): boolean {
  return process.env.APP_ENV === "production" && process.env.PUBLIC_INDEXING === "true";
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const auth = req.headers.get("authorization");

  if (isInternal(path)) {
    const r = checkInternalAuth(auth);
    if (r === "disabled") {
      return new NextResponse("Internal console disabled: set INTERNAL_USER and INTERNAL_PASSWORD (npm run setup).", { status: 503 });
    }
    if (r === "unauthorized") {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="internal", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" },
      });
    }
  } else if (!checkSiteAccess(auth)) {
    return new NextResponse("Preview access required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="preview", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const res = NextResponse.next();
  // Belt and braces: every non-production response is noindex, whatever the page metadata says.
  if (!indexingAllowed() || isInternal(path)) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (isInternal(path)) res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|placeholders/).*)"],
};
