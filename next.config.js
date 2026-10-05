/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @xenova/transformers (used for local embeddings in lib/embeddings.js) ships
  // a native ONNX runtime binary that webpack can't bundle — this tells Next.js
  // to require() it directly at runtime instead of trying to package it.
  experimental: {
    serverComponentsExternalPackages: ["@xenova/transformers", "onnxruntime-node"],
  },
};

module.exports = nextConfig;
