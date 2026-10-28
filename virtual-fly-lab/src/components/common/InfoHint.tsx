import { Info } from 'lucide-react';
import { useId } from 'react';

/** Small info icon revealing an explanatory tooltip on hover or keyboard focus. */
export function InfoHint({ text, label = 'More information' }: { text: string; label?: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" aria-label={label} aria-describedby={id} className="text-ink-500 hover:text-ink-300 focus:text-ink-300">
        <Info size={12} aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-full z-50 mt-1.5 w-60 -translate-x-1/2 rounded border border-ink-600 bg-ink-800 px-2.5 py-2 text-[11.5px] font-normal normal-case leading-snug tracking-normal text-ink-200 shadow-lg group-focus-within:visible group-hover:visible"
      >
        {text}
      </span>
    </span>
  );
}
