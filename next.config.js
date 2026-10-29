/** @type {import('next').NextConfig} */
const nextConfig = {
  // Chromium headless ne doit pas être bundlé par Next.js (fichier binaire).
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};
module.exports = nextConfig;
