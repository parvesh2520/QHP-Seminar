import { useEffect } from 'react';
import { LabPanel } from './components/lab/LabPanel';
import { AppHeader } from './components/layout/AppHeader';
import { WelcomeDialog } from './components/layout/WelcomeDialog';
import { NetworkViewer } from './components/network/NetworkViewer';
import { useLabStore } from './store/labStore';

export default function App() {
  const selectNeuron = useLabStore((s) => s.selectNeuron);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === 'Escape' && !el.closest('input, select, textarea, dialog')) selectNeuron(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectNeuron]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader />
      <WelcomeDialog />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
        <main className="min-h-0 max-lg:h-[60vh]">
          <NetworkViewer />
        </main>
        <aside className="min-h-0 border-ink-800 bg-ink-900 lg:border-l" aria-label="Experiment">
          <LabPanel />
        </aside>
      </div>
    </div>
  );
}
