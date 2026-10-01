import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Адрес API берётся из переменной VITE_API_URL (см. .env.example)
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
