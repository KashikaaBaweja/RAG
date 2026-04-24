/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@rag/ingestion",
    "langchain",
    "@langchain/core",
    "@langchain/openai",
  ],
};

export default nextConfig;
