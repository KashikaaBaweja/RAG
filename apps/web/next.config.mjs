/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" } : {}),
  eslint: {
    dirs: ["app", "components", "hooks", "lib", "types"],
  },
  experimental: {
    // @rag/ingestion stays external so pdf-parse/mammoth resolve from its own
    // node_modules at runtime instead of being bundled (pdf-parse breaks when bundled).
    serverComponentsExternalPackages: [
      "@prisma/client",
      "bullmq",
      "ioredis",
      "@rag/ingestion",
      "pdf-parse",
      "mammoth",
    ],
  },
};

export default nextConfig;
