import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Pre-bundle third-party deps up front so Vite does not discover them
  // mid-session and trigger a re-optimization that rejects in-flight
  // dynamic imports ("Failed to fetch dynamically imported module").
  // (Config touched to force a clean dev-server restart + re-optimize.)
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router',
      'recharts',
      'motion/react',
      'lucide-react',
    ],
  },
})
