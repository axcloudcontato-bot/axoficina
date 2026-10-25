import { cn } from '@/lib/utils';

/*
 * Logo OFIX redesenhado em vetor a partir das pranchas em /Logo.
 * Cores: partes neutras herdam `currentColor`; o amarelo vem de --brand-yellow
 * (sempre #FFBE00, a cor da marca não muda com o tema).
 */
const RING = 'M120 345a150 150 0 1 0 300 0a150 150 0 1 0 -300 0ZM190 345a80 80 0 1 1 160 0a80 80 0 1 1 -160 0Z';
const GEAR = [
  'M142.3 245.3A162 162 0 0 1 397.7 245.3L424.5 224.3A196 196 0 0 0 115.5 224.3Z',
  'M233.0 160.0L237.4 117.0L302.6 117.0L307.0 160.0Z',
  'M120.2 230.9L94.5 196.2L140.3 155.0L172.2 184.1Z',
  'M367.8 184.1L399.7 155.0L445.5 196.2L419.8 230.9Z',
];
const LETTERS = ['M445 205H680V262H525V308H660V366H525V480H445Z', 'M700 205H785V480H700Z'];
const X_DARK = 'M800 205H885L960 342L880 480H795L875 342Z';
const X_YELLOW = ['M978 205H1062L985 310L940 250Z', 'M940 385L985 374L1055 480H940Z', 'M1075 205H1190L1101 342L1178 480H1066L975 342Z'];
const YELLOW = 'var(--brand-yellow, #FFBE00)';

type Props = {
  variant?: 'full' | 'icon' | 'mark';
  /** Mostra "SISTEMA PARA OFICINA MECÂNICA" abaixo (só na variante full). */
  tagline?: boolean;
  /** Ícone/marca em amarelo sólido em vez de neutro. */
  accent?: boolean;
  className?: string;
  title?: string;
};

export function OfixLogo({ variant = 'full', tagline = false, accent = false, className, title = 'Ofix' }: Props) {
  if (variant === 'icon') {
    return (
      <svg viewBox="85 100 370 400" role="img" aria-label={title} className={cn('h-auto', className)} fill={accent ? YELLOW : 'currentColor'}>
        <path fillRule="evenodd" d={RING} />
        {GEAR.map((d) => <path key={d} d={d} />)}
      </svg>
    );
  }
  if (variant === 'mark') {
    return (
      <svg viewBox="785 195 415 300" role="img" aria-label={title} className={cn('h-auto', className)}>
        <path d={X_DARK} fill={accent ? YELLOW : 'currentColor'} />
        <g fill={YELLOW}>{X_YELLOW.map((d) => <path key={d} d={d} />)}</g>
      </svg>
    );
  }
  return (
    <svg viewBox={tagline ? '85 95 1120 480' : '85 95 1120 410'} role="img" aria-label={title} className={cn('h-auto', className)}>
      <g fill="currentColor">
        <path fillRule="evenodd" d={RING} />
        {GEAR.map((d) => <path key={d} d={d} />)}
        {LETTERS.map((d) => <path key={d} d={d} />)}
        <path d={X_DARK} />
      </g>
      <g fill={YELLOW}>{X_YELLOW.map((d) => <path key={d} d={d} />)}</g>
      {tagline && (
        <text x="120" y="556" fill="currentColor" textLength="1070" lengthAdjust="spacingAndGlyphs" style={{ fontFamily: "var(--font-sans), 'Montserrat Variable', sans-serif", fontWeight: 700, fontSize: 64 }}>
          SISTEMA PARA OFICINA MECÂNICA
        </text>
      )}
    </svg>
  );
}
