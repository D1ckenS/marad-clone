import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui-kit/src/**/*.{ts,tsx}'],
} satisfies Config;
