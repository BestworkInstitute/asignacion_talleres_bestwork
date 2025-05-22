// next.config.js
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ✅ Evita que errores como variables no usadas rompan el build
    ignoreDuringBuilds: true,
  },
  experimental: {
    turbo: {},
  },
};

module.exports = nextConfig;
