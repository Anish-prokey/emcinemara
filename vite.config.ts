import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  esbuild: {
    // Escape every non-ASCII character in the output. The dataset and UI carry
    // Devanagari, Tamil, Telugu, Malayalam and Kannada text, and the search
    // regexes carry Unicode ranges — if anything serves the bundle as Latin-1
    // the app dies at module load. ASCII output cannot be mis-decoded.
    charset: 'ascii',
  },
})
