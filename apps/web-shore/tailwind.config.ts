import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui-kit/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ui: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        bg: '#FAFAF7',
        surface: { DEFAULT: '#FFFFFF', 2: '#F4F2EC', sunk: '#EFEDE6', tint: '#F8F6F0' },
        ink: { DEFAULT: '#0A1F33', 2: '#41546A', 3: '#8893A0', 4: '#B6BDC6' },
        hairline: '#EEEBE2',
        border: { DEFAULT: '#E5E3DA', strong: '#CECABE' },
        navy: { DEFAULT: '#0A1F33', 2: '#14304B' },
        signal: {
          green: '#2F7D4F',
          'green-bg': '#E2EEE6',
          amber: '#B5731E',
          'amber-bg': '#F4E7D0',
          red: '#AB382E',
          'red-bg': '#F2DDD8',
          purple: '#5E479F',
          'purple-bg': '#E7E0F1',
          blue: '#1F5B9D',
          'blue-bg': '#DDE7F3',
        },
      },
      borderColor: {
        DEFAULT: '#E5E3DA',
        hairline: '#EEEBE2',
      },
      borderRadius: {
        '1': '4px',
        '2': '6px',
        '3': '10px',
        '4': '14px',
      },
    },
  },
} satisfies Config;
