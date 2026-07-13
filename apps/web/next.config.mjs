/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel does not need standalone output and can fail copying traced
  // app-router manifests for route groups (e.g. "(dashboard)").
  // Keep standalone for non-Vercel production targets like Docker.
  ...(process.env.VERCEL
    ? {}
    : process.env.NODE_ENV === "production"
      ? { output: "standalone" }
      : {}),
  eslint: {
    dirs: ["app", "components", "hooks", "lib", "types"],
  },
  experimental: {
    // pdf-parse/mammoth stay external so they resolve from node_modules at
    // runtime instead of being bundled (pdf-parse breaks when bundled).
    serverComponentsExternalPackages: [
      "@prisma/client",
      "bullmq",
      "ioredis",
      "pdf-parse",
      "mammoth",
    ],
  },
  // Only transpile our workspace package; LangChain is already ESM-ready and
  // compiling it on every request made first page loads extremely slow.
  transpilePackages: ["@rag/ingestion"],
};

export default nextConfig;
