import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#2E2547',
          700: '#4B3F72',
          500: '#6B5CA5',
          100: '#EDE9F7',
        },
        accent: {
          urgent: '#E8792B',
          verified: '#2FA36B',
        },
        bg: {
          DEFAULT: '#FFFFFF',
          soft: '#F7F5F2',
        },
        border: '#E7E3DD',
        text: {
          DEFAULT: '#1C1A22',
          muted: '#6E6A78',
        },
      },
      borderRadius: {
        card: '12px',
        input: '10px',
        badge: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(46,37,71,.06)',
      },
      spacing: {
        4.5: '1.125rem',
      },
    },
  },
  plugins: [],
};

export default config;
