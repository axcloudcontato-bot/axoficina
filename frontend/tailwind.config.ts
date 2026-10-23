import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './features/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          foreground: 'var(--primary-foreground)',
        },
        bg: 'var(--background)',
        surface: 'var(--surface)',
        border: 'var(--color-border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        selection: 'var(--selection)',
        success: {
          DEFAULT: 'var(--success)',
          subtle: 'var(--success-subtle)',
          strong: 'var(--success-strong)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          subtle: 'var(--danger-subtle)',
          strong: 'var(--danger-strong)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          subtle: 'var(--warning-subtle)',
          strong: 'var(--warning-strong)',
        },
        info: {
          DEFAULT: 'var(--info)',
          subtle: 'var(--info-subtle)',
          strong: 'var(--info-strong)',
        },
        // Contrato shadcn — ver comentário em globals.css. Sem estes, as
        // classes bg-card/bg-muted/bg-accent/border-input/ring-ring etc.
        // usadas pelos primitivos (Button, Select, Dialog, Table...) não
        // resolvem pra nenhuma cor.
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      // Tailwind v3 usa `currentColor` como cor padrão da classe `border`
      // sem sufixo (usada em Card/Table) — sem isto, cards ganham uma
      // borda escura (= cor do texto) em vez do cinza sutil esperado.
      borderColor: {
        DEFAULT: 'var(--border)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        button: 'var(--radius-button)',
        dialog: 'var(--radius-dialog)',
        pill: '999px',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
      },
      boxShadow: {
        'inner-subtle': 'var(--shadow-inner-subtle)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        popover: 'var(--shadow-popover)',
      },
      transitionTimingFunction: {
        settle: 'var(--ease-settle)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
