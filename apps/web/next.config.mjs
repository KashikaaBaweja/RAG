/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone only needed for Docker/production images — skip in local for faster boot
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" } : {}),
  eslint: {
    dirs: ["app", "components", "hooks", "lib", "types"],
  },
  // Only transpile our workspace package; LangChain is already ESM-ready and
  // compiling it on every request made first page loads extremely slow.
  transpilePackages: ["@rag/ingestion"],
  experimental: {
    // Only packages that are direct deps of `web` (Turbopack requires that).
    serverComponentsExternalPackages: ["@prisma/client", "bullmq", "ioredis"],
  },
};

export default nextConfig;
