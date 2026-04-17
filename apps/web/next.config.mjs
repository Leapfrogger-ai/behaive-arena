/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The worker + web share typed packages; let Next compile them rather
    // than requiring a pre-built dist.
    externalDir: true,
  },
  transpilePackages: ["@behaive/chain", "@behaive/db"],
};

export default nextConfig;
