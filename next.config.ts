import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.60.103"],
  output: "standalone",
};

export default nextConfig;
