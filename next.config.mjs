/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Development builds must never be indexed. Production indexing is opt-in
  // through SITE_INDEXING=on (see src/lib/site.ts); until then every response
  // carries noindex as a second safeguard behind access control.
  async headers() {
    const indexing = process.env.SITE_INDEXING === "on";
    return indexing
      ? []
      : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};
export default nextConfig;
