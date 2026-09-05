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
    "/api/**": ["./public/fonts/**"],
  },
};

export default withNextIntl(nextConfig);
