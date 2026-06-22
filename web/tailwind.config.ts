import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#16a34a', // fresh green
          dark: '#15803d',
          light: '#dcfce7',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
