import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 px-6 py-8 text-center">
      <Icon size={22} className="text-ink-500" aria-hidden />
      <p className="text-[13px] font-medium text-ink-200">{title}</p>
      {children && <div className="max-w-sm text-[12px] leading-relaxed text-ink-400">{children}</div>}
    </div>
  );
}
