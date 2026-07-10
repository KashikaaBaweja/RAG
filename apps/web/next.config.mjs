/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" } : {}),
  eslint: {
    dirs: ["app", "components", "hooks", "lib", "types"],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bullmq", "ioredis"],
  },
};

export default nextConfig;
