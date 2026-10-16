/** @type {import('tailwindcss').Config} */
// Colours live in CSS variables (app/globals.css, :root). They are stored as RGB channels so that
// Tailwind opacity modifiers (bg-accent/15) keep working.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    borderRadius: {
      none: '0',
      sm: '6px',
      DEFAULT: '10px',
      md: '10px',
      lg: '12px',
      xl: '16px',
      '2xl': '20px',
      '3xl': '28px',
      full: '9999px',
    },
    extend: {
      colors: {
        ground: token('ground'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        accent: {
          DEFAULT: token('accent'),
          ink: token('accent-ink'),
        },
        danger: token('danger'),
        success: token('success'),
      },
      boxShadow: {
        card: '0 1px 2px rgb(28 28 30 / 0.04)',
        lift: '0 2px 6px rgb(28 28 30 / 0.05), 0 12px 28px -16px rgb(28 28 30 / 0.18)',
      },
      fontFamily: {
        sans: ['var(--font-onest)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
