/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // O browser fala com o próprio Next; o Next repassa à API
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:3001'}/v1/:path*`,
      },
    ];
  },
};
export default nextConfig;
