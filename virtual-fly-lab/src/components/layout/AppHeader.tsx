import { BookOpen } from 'lucide-react';
import { useRef } from 'react';
import { ModelInfoDialog } from './ModelInfoDialog';

export function AppHeader() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-900 px-5">
      <Wordmark />
      <div className="min-w-0 leading-tight">
        <div className="text-[16px] font-semibold tracking-tight text-ink-100">Virtual Fly Lab</div>
        <div className="truncate text-[13px] text-ink-400">Experiment on a real fruit fly brain, right in your browser</div>
      </div>
      <button type="button" className="btn btn-default ml-auto h-9 px-3" onClick={() => dialogRef.current?.showModal()}>
        <BookOpen size={16} strokeWidth={1.5} aria-hidden /> How it works
      </button>
      <ModelInfoDialog ref={dialogRef} />
    </header>
  );
}

/** Mark: three connected neurons. */
function Wordmark() {
  return (
    <svg width="32" height="32" viewBox="0 0 22 22" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="21" height="21" rx="6" fill="#191a1d" stroke="#3a3d42" />
      <path d="M6 15 L11 6 L16 15" fill="none" stroke="#5b5f66" strokeWidth="1.2" />
      <circle cx="11" cy="6" r="2" fill="#eceded" />
      <circle cx="6" cy="15" r="2" fill="#3987e5" />
      <circle cx="16" cy="15" r="2" fill="#8a8e95" />
    </svg>
  );
}
