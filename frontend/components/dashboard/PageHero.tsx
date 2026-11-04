import type { ReactNode } from 'react';

type PageHeroProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHero({ eyebrow, title, description, actions, className = '' }: PageHeroProps) {
  return (
    <header className={`flex flex-col gap-4 rounded-card border border-border bg-card p-4 shadow-sm sm:p-5 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 lg:shrink-0">{actions}</div>}
    </header>
  );
}
