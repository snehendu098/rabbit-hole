import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // static export → firebase hosting
  output: 'export',
  images: { unoptimized: true },
  reactCompiler: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default nextConfig
