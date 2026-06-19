/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0B1220',
          card: '#111827',
          border: '#1F2937',
          hover: '#1a2332',
        },
        primary: { DEFAULT: '#3B82F6', hover: '#2563EB' },
        success: { DEFAULT: '#22C55E', hover: '#16A34A' },
        danger: { DEFAULT: '#EF4444', hover: '#DC2626' },
        warning: { DEFAULT: '#F59E0B', hover: '#D97706' },
        text: { primary: '#F9FAFB', secondary: '#9CA3AF', muted: '#6B7280' },
      },
      fontFamily: {
        mono: ['"SF Mono"', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: { card: '16px' },
    },
  },
  plugins: [],
}
