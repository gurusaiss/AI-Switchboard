import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#dbe6ff',
          500: '#3b5bfd',
          600: '#2f47d6',
          700: '#2536a8',
        },
      },
    },
  },
  plugins: [],
};

export default config;
