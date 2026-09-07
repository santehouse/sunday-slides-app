import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Asset/font uploads go through Server Actions. Next's default is 1 MB, which a
      // 1920×1080 photo exceeds; Vercel's own request cap is 4.5 MB, so 4 MB is the
      // practical ceiling (the dialogs explain the limit when a file is bigger).
      bodySizeLimit: "4mb",
    },
  },
  serverExternalPackages: [
    "puppeteer-core",
    "@sparticuz/chromium",
    "ffmpeg-static",
    "mammoth",
    "unpdf",
  ],
  outputFileTracingIncludes: {
    // `@sparticuz/chromium`'s compressed Chromium/fonts/swiftshader binaries and
    // `ffmpeg-static`'s ffmpeg binary are only ever referenced by a runtime-computed
    // path string (extracted/spawned, never `require()`d or `fs.readFileSync`'d
    // directly) — Next's file tracer can't see that, so without this the deployed
    // function silently ships without the actual binaries. See docs/RENDERING.md.
    "/api/**": [
      "./public/fonts/**",
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg",
    ],
  },
};

export default withNextIntl(nextConfig);
