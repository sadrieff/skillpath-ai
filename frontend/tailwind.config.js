/** @type {import('tailwindcss').Config} */
// Colours live in CSS variables (app/globals.css, :root). They are stored as RGB channels so that
// Tailwind opacity modifiers (bg-accent/15) keep working.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    // One radius for the whole app.
    borderRadius: {
      none: '0',
      DEFAULT: '6px',
      sm: '6px',
      md: '6px',
      lg: '6px',
      xl: '6px',
      '2xl': '6px',
      '3xl': '6px',
      full: '6px',
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
      fontFamily: {
        sans: ['var(--font-onest)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
