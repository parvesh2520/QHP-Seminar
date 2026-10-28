import { useEffect } from 'react';
import { ExperimentPanel } from './components/experiments/ExperimentPanel';
import { AppHeader } from './components/layout/AppHeader';
import { NetworkExplorer } from './components/network/NetworkExplorer';
import { CandidatesPage } from './pages/CandidatesPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { ExplorePage } from './pages/ExplorePage';
import { useLabStore } from './store/labStore';

export default function App() {
  const tab = useLabStore((s) => s.tab);
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
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[280px_minmax(0,1fr)_316px] lg:overflow-hidden">
        <aside className="order-2 min-h-0 border-ink-800 bg-ink-900 max-lg:h-[640px] lg:order-1 lg:border-r" aria-label="Network explorer">
          <NetworkExplorer />
        </aside>
        <main id="main-view" role="tabpanel" aria-labelledby={`tab-${tab}`} className="order-1 min-h-0 max-lg:min-h-[480px] lg:order-2">
          {tab === 'explore' && <ExplorePage />}
          {tab === 'experiments' && <ExperimentsPage />}
          {tab === 'candidates' && <CandidatesPage />}
        </main>
        <aside className="order-3 min-h-0 border-ink-800 bg-ink-900 max-lg:h-[720px] lg:border-l" aria-label="Experiment configuration">
          <ExperimentPanel />
        </aside>
      </div>
    </div>
  );
}
