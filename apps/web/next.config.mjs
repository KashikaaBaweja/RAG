/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    dirs: ["app", "components", "hooks", "lib", "types"],
  },
  transpilePackages: [
    "@rag/ingestion",
    "langchain",
    "@langchain/core",
    "@langchain/openai",
  ],
};

export default nextConfig;
