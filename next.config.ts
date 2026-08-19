import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/utforsk', destination: '/dashboard/utforsk', permanent: true },
      { source: '/utforsk/:path*', destination: '/dashboard/utforsk/:path*', permanent: true },
      { source: '/min-side', destination: '/dashboard/min-side', permanent: true },
      { source: '/varsler', destination: '/dashboard/varsler', permanent: true },
      { source: '/horinger', destination: '/dashboard/horinger', permanent: true },
      { source: '/horinger/:path*', destination: '/dashboard/horinger/:path*', permanent: true },
      { source: '/avstemninger', destination: '/dashboard/avstemninger', permanent: true },
      { source: '/avstemninger/:path*', destination: '/dashboard/avstemninger/:path*', permanent: true },
      { source: '/initiativ', destination: '/dashboard/initiativ', permanent: true },
      { source: '/initiativ/:path*', destination: '/dashboard/initiativ/:path*', permanent: true },
      { source: '/forum', destination: '/dashboard/utforsk', permanent: true },
      { source: '/forum/:path*', destination: '/dashboard/utforsk', permanent: true },
      { source: '/dashboard/forum', destination: '/dashboard/utforsk', permanent: true },
      { source: '/dashboard/forum/:path*', destination: '/dashboard/utforsk', permanent: true },
      { source: '/sak/:id', destination: '/dashboard/sak/:id', permanent: true },
      { source: '/politikere', destination: '/dashboard/politikere', permanent: true },
      { source: '/representanter', destination: '/dashboard/representanter', permanent: true },
      { source: '/politiker-hub', destination: '/dashboard/politiker-hub', permanent: true },
      { source: '/saksganger', destination: '/dashboard/saksganger', permanent: true },
      { source: '/sporsmal', destination: '/dashboard/sporsmal', permanent: true },
    ];
  },
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'data.stortinget.no',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
