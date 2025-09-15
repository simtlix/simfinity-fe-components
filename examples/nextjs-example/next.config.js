/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['simfinity-fe-components'],
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

module.exports = nextConfig;
