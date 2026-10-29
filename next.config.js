/** @type {import('next').NextConfig} */
const nextConfig = {
  // Chromium headless ne doit pas être bundlé par Next.js (fichier binaire).
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Keep the Brotli payload beside the externalized package in Vercel's
  // traced server function. Chromium resolves this directory at runtime.
  outputFileTracingIncludes: {
    "/api/export": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/katex/dist/fonts/**",
      "./lib/katex-inline.txt",
    ],
  },
};
module.exports = nextConfig;
