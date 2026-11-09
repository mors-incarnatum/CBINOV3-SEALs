import type { NextConfig } from "next";
const nextConfig: NextConfig = {
    distDir: process.env.WIKAHON_BUILD_DIR || ".next",
};
export default nextConfig;
