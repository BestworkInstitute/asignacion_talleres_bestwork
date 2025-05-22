// Configuración de Next.js 🚀

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['res.cloudinary.com', 'localhost'],
  },
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
