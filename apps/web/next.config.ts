import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

/**
 * Optional same-origin proxy (server-side, read at build time). When the API
 * lives on a different site than the web app (e.g. *.vercel.app → *.onrender.com),
 * its cookies would be third-party, which Safari and others block. Set
 * API_PROXY_URL to the API's origin and NEXT_PUBLIC_API_URL=/api/v1: the
 * browser then only talks to this origin, and /api/v1/* is forwarded to the API,
 * so auth cookies are first-party and SameSite=Lax works.
 */
const apiProxyUrl = process.env.API_PROXY_URL?.replace(/\/+$/, "");

// Fail the build rather than ship a client that can't reach its API.
const LOCAL_HOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;
if (!apiUrl.startsWith("/") && !apiUrl.startsWith("https://") && !LOCAL_HOST.test(apiUrl)) {
  throw new Error(
    `NEXT_PUBLIC_API_URL must be an https:// URL, a same-origin path such as /api/v1, or http://localhost (got "${apiUrl}")`,
  );
}
if (apiProxyUrl && !/^https?:\/\//.test(apiProxyUrl)) {
  throw new Error(`API_PROXY_URL must be an http(s) origin (got "${apiProxyUrl}")`);
}

// A relative NEXT_PUBLIC_API_URL (proxy mode) is same-origin: covered by 'self'.
const apiOrigin = apiUrl.startsWith("/") ? "" : new URL(apiUrl).origin;

/**
 * CSP is shipped as Report-Only: Next.js injects inline bootstrap scripts, so an
 * enforcing policy needs per-request nonces (middleware) to avoid 'unsafe-inline'.
 * Violations show in the browser console; promote to enforcing once verified.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin}`.trim(),
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProduction
    ? [
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
      ]
    : []),
];

const nextConfig: NextConfig = {
  transpilePackages: ["@task-time-tracker/shared"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return apiProxyUrl
      ? [{ source: "/api/v1/:path*", destination: `${apiProxyUrl}/api/v1/:path*` }]
      : [];
  },
};

export default nextConfig;
