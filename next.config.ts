import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.6",
    "10.0.0.56",
    "*.local",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;
