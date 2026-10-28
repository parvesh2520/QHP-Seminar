import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Titled block inside a panel. */
export function Section({ title, actions, children, className = '' }: SectionProps) {
  return (
    <section className={`border-b border-ink-800 px-3 py-3 ${className}`} aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="panel-title">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Bordered card used in the results workspace. */
export function Card({ title, subtitle, actions, children, className = '' }: SectionProps & { subtitle?: ReactNode }) {
  return (
    <section className={`rounded border border-ink-800 bg-ink-900 ${className}`} aria-label={title}>
      <header className="flex items-start justify-between gap-3 border-b border-ink-800 px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-[12.5px] font-semibold text-ink-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11.5px] text-ink-400">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}
