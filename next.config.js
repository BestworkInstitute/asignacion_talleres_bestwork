// next.config.js
const nextConfig = {
  reactStrictMode: true,

  // 🔐 Esto evita que errores de ESLint detengan la build en Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ⚡ Habilita Turbopack correctamente en Next.js 15
  experimental: {
    turbo: {},
  },
};

module.exports = nextConfig;
