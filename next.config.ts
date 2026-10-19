import type {NextConfig} from 'next';

const SECURITY_HEADERS = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
] as const;

const DEFAULT_CSP =
  "default-src 'self'; base-uri 'self'; form-action 'self'; " +
  "frame-ancestors 'self'; object-src 'none'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
  "style-src 'self' 'unsafe-inline' https:; " +
  "img-src 'self' data: blob: https:; font-src 'self' data: https:; " +
  "connect-src 'self' https: wss:; frame-src 'self' https:;";

const CSP_REPORT_ONLY = DEFAULT_CSP;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Embeddable widget: open to all hosts (the content is public and
        // votes cannot be cast inside the iframe).
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          ...SECURITY_HEADERS,
        ],
      },
      {
        // Everything else: block framing (clickjacking protection).
        source: '/((?!embed).*)',
        headers: [
          { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          ...SECURITY_HEADERS,
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/utforsk', destination: '/dashboard/utforsk', permanent: true },
      { source: '/utforsk/:path*', destination: '/dashboard/utforsk/:path*', permanent: true },
      { source: '/min-side', destination: '/dashboard/min-side', permanent: true },
      { source: '/varsler', destination: '/dashboard/utforsk', permanent: true },
      { source: '/dashboard/varsler', destination: '/dashboard/utforsk', permanent: false },
      { source: '/horinger', destination: '/dashboard/horinger', permanent: true },
      { source: '/horinger/:path*', destination: '/dashboard/horinger/:path*', permanent: true },
      { source: '/kalender', destination: '/dashboard/kalender', permanent: true },
      { source: '/avstemninger', destination: '/dashboard/avstemninger', permanent: true },
      { source: '/avstemninger/reels', destination: '/dashboard/utforsk/reels', permanent: true },
      { source: '/avstemninger/:path*', destination: '/dashboard/avstemninger/:path*', permanent: true },
      { source: '/initiativ', destination: '/dashboard/utforsk', permanent: true },
      { source: '/initiativ/:path*', destination: '/dashboard/utforsk', permanent: true },
      { source: '/dashboard/initiativ', destination: '/dashboard/utforsk', permanent: true },
      { source: '/dashboard/initiativ/:path*', destination: '/dashboard/utforsk', permanent: true },
      { source: '/forum', destination: '/dashboard/folkets-meninger', permanent: true },
      { source: '/forum/:path*', destination: '/dashboard/folkets-meninger', permanent: true },
      { source: '/dashboard/forum', destination: '/dashboard/folkets-meninger', permanent: true },
      { source: '/dashboard/forum/:path*', destination: '/dashboard/folkets-meninger', permanent: true },
      { source: '/sak/:id', destination: '/dashboard/sak/:id', permanent: true },
      { source: '/politikere', destination: '/dashboard/politikere', permanent: true },
      { source: '/representanter', destination: '/dashboard/representanter', permanent: true },
      { source: '/politiker-hub', destination: '/dashboard/politikere', permanent: true },
      { source: '/dashboard/politiker-hub', destination: '/dashboard/politikere', permanent: true },
      { source: '/dashboard/avstemninger/reels', destination: '/dashboard/utforsk/reels', permanent: true },
      { source: '/reels', destination: '/dashboard/utforsk/reels', permanent: true },
      { source: '/dashboard/reels', destination: '/dashboard/utforsk/reels', permanent: true },
      { source: '/dashboard/forslag', destination: '/dashboard/appens-fremtid', permanent: false },
      { source: '/forslag', destination: '/dashboard/appens-fremtid', permanent: false },
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
