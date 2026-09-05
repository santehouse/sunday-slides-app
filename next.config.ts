import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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
