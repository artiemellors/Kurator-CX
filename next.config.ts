import type { NextConfig } from 'next'

const config: NextConfig = {
  serverExternalPackages: ['playwright'],
  experimental: { instrumentationHook: true },
}

export default config
