import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Taula Systems',
    short_name: 'Taula',
    description: 'Gestió de reserves per a restaurants',
    start_url: '/avui',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#B45309',
    theme_color: '#B45309',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
