/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@rag/ingestion",
    "langchain",
    "@langchain/core",
    "@langchain/openai",
  ],
};

export default nextConfig;
