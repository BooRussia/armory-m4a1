import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';

const standalone = process.env.ARMORY_PAGES === '1' || !existsSync('.openai/hosting.json');
const nextConfig: NextConfig = standalone ? {
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  trailingSlash: true,
  images: { unoptimized: true },
} : {};

export default nextConfig;
