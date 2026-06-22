/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Transpile the shared workspace package (it ships raw TS).
  transpilePackages: ['@pantrytoplate/shared'],
  images: {
    // TheMealDB serves recipe thumbnails from this host.
    remotePatterns: [{ protocol: 'https', hostname: 'www.themealdb.com' }],
  },
};

export default nextConfig;
