/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/frontend/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: '#1B7A4A',
          light: 'rgba(27,122,74,0.08)',
        },
        'dark-green': '#2D5016',
        'text': '#18181B',
        'text-2': '#6b7280',
        'text-3': '#9ca3af',
        'bg': '#F9FAFB',
        'border': '#e5e7eb',
        'border-2': '#f3f4f6',
        'red': '#e11d48',
        // shadcn CSS variable colors
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        heading: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        sm: '8px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
