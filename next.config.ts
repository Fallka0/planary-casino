import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The shop became the market; old links and bookmarks land on your inventory.
  async redirects() {
    return [{ source: "/shop", destination: "/market?tab=inventory", permanent: true }];
  },
};

export default nextConfig;
