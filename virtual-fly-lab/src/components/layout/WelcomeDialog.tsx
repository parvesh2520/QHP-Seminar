import { Play } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLabStore } from '../../store/labStore';

const SEEN_KEY = 'vfl-welcome-seen';

const STEPS = [
  { title: 'Look at the brain', text: 'Every dot is a real neuron from a fruit fly brain. Lines show which neurons talk to each other.' },
  { title: 'Change one neuron', text: 'Pick a neuron and switch it up (excite) or down (suppress) for a moment.' },
  { title: 'See what changed', text: 'The brain is simulated twice, with and without your change. The charts show the difference.' },
];

/** First-visit introduction with a one-click demo run. Shown once per browser session. */
export function WelcomeDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const runExperiment = useLabStore((s) => s.runExperiment);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      /* storage blocked: just show it */
    }
    if (!seen) ref.current?.showModal();
  }, []);

  const close = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    ref.current?.close();
  };

  const runDemo = () => {
    close();
    void runExperiment();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="welcome-title"
      onCancel={close}
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-lg border border-ink-700 bg-ink-900 p-0 text-ink-200 backdrop:bg-black/70"
    >
      <div className="px-6 pb-2 pt-6">
        <h2 id="welcome-title" className="text-[20px] font-semibold text-ink-100">Welcome to Virtual Fly Lab</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-300">
          A virtual lab where you switch neurons in a fruit fly brain on or off and watch how the rest of the brain reacts. No biology background needed.
        </p>
      </div>
      <ol className="space-y-3 px-6 py-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="step step-active mt-0.5">{i + 1}</span>
            <div>
              <div className="text-[14px] font-medium text-ink-100">{s.title}</div>
              <div className="text-[13px] leading-relaxed text-ink-400">{s.text}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-end gap-2 border-t border-ink-800 px-6 py-4">
        <button type="button" className="btn btn-ghost h-10 px-4" onClick={close}>
          Explore on my own
        </button>
        <button type="button" className="btn btn-primary h-10 px-4 text-[14px]" onClick={runDemo} autoFocus>
          <Play size={16} strokeWidth={1.5} aria-hidden /> Run a demo experiment
        </button>
      </div>
    </dialog>
  );
}
