/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "100mb" },
  },
  env: {
    NEXT_PUBLIC_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "drive.google.com" },
    ],
  },
};
module.exports = nextConfig;
