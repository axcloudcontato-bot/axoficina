'use client';

import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface AnimatedIconProps {
  icon: PhosphorIcon;
  /** Mantém o peso preenchido fixo (ex.: item de navegação já ativo). */
  active?: boolean;
  className?: string;
}

// Crossfade puro CSS entre o traço (regular) e o preenchido (fill) do mesmo
// glifo Phosphor. Precisa de um ancestral com a classe `group` para reagir
// ao hover — nenhum JS de estado, só duas camadas empilhadas.
export function AnimatedIcon({ icon: Icon, active = false, className }: AnimatedIconProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <Icon
        weight="regular"
        className={cn(
          'transition-[opacity,transform] duration-fast ease-settle',
          active ? 'scale-90 opacity-0' : 'scale-100 opacity-100 group-hover:scale-90 group-hover:opacity-0',
          className,
        )}
      />
      <Icon
        weight="fill"
        aria-hidden="true"
        className={cn(
          'absolute inset-0 transition-[opacity,transform] duration-fast ease-settle',
          active ? 'scale-100 opacity-100' : 'scale-110 opacity-0 group-hover:scale-100 group-hover:opacity-100',
          className,
        )}
      />
    </span>
  );
}
