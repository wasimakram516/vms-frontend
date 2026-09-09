/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/staff",
        destination: "/auth/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
