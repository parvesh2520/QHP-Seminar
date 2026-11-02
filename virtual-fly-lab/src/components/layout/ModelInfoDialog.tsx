import { X } from 'lucide-react';
import { forwardRef } from 'react';
import { DEFAULT_LIF_PARAMS, DEFAULT_SYNAPSE_PARAMS, peakPspForWeight } from '../../simulation/lifModel';
import { useLabStore } from '../../store/labStore';

/** Native <dialog> describing the model, data and their limitations. */
export const ModelInfoDialog = forwardRef<HTMLDialogElement>(function ModelInfoDialog(_, ref) {
  const network = useLabStore((s) => s.network);
  const p = DEFAULT_LIF_PARAMS;
  const syn = DEFAULT_SYNAPSE_PARAMS;
  const pspPerUnit = peakPspForWeight(1, p.tauM, syn.tauSynExcMs);
  const close = () => (ref as React.RefObject<HTMLDialogElement>).current?.close();

  return (
    <dialog
      ref={ref}
      aria-labelledby="model-info-title"
      className="m-auto max-h-[85vh] w-[min(720px,calc(100vw-32px))] overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-0 text-ink-200 backdrop:bg-black/60"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-ink-800 bg-ink-900 px-6 py-4">
        <h2 id="model-info-title" className="text-[16px] font-semibold text-ink-100">How Virtual Fly Lab works</h2>
        <button type="button" className="btn btn-ghost h-6 px-1.5" onClick={close} aria-label="Close model information">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-6 px-6 py-6 text-[14px] leading-relaxed">
        <section>
          <h3 className="panel-title mb-2">The idea in one minute</h3>
          <ol className="space-y-2 text-ink-300">
            <li className="flex gap-3"><span className="step">1</span><span>A fruit fly brain is a network of neurons. Each one fires short electrical pulses called <strong className="text-ink-100">spikes</strong> and passes them on to the neurons it is wired to.</span></li>
            <li className="flex gap-3"><span className="step">2</span><span>You pick one neuron and <strong className="text-ink-100">excite</strong> it (make it fire more) or <strong className="text-ink-100">suppress</strong> it (make it fire less) for a short time.</span></li>
            <li className="flex gap-3"><span className="step">3</span><span>The lab runs the brain twice, once untouched (the <strong className="text-ink-100">control</strong>) and once with your change, then counts the spikes in a region you choose. The difference shows how much that neuron matters.</span></li>
          </ol>
        </section>

        <section>
          <h3 className="panel-title mb-1.5">Where the brain data comes from</h3>
          {network.metadata.source === 'connectome-subset' ? (
            <ul className="list-disc space-y-1.5 pl-4 text-ink-300">
              <li>
                <strong className="text-ink-100">FlyWire adult fruit fly connectome (v783)</strong>: Extracted from the complete EM reconstructed adult fruit fly brain (FlyWire Consortium, Princeton & Cambridge; published in <em>Nature 2024</em>: Dorkenwald et al., Schlegel et al.).
              </li>
              <li>
                <strong className="text-ink-100">Circuits included</strong>: Includes the complete smell pathway (ORNs & Antennal Lobe PNs/LNs), mushroom body learning centre (Kenyon Cells), the <strong className="text-ink-100">giant APL feedback inhibitory neuron</strong> (GABAergic gain control), central complex compass network (E-PG/P-EN), and descending motor command neurons (DNs).
              </li>
              <li>
                <strong className="text-ink-100">Real IDs and positions</strong>: Carries authentic 64-bit FlyWire root IDs (e.g. <span className="font-mono text-ink-200">7205759406...</span>), biological cell types, and spatial coordinates mapped to the FAFB/JRC2018 adult fly brain template.
              </li>
              <li>
                <strong className="text-ink-100">What is approximate</strong>: While structural synapse counts are genuine, physiological conductances in the LIF model are uncalibrated voltage-equivalent proxies.
              </li>
            </ul>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-ink-300">
              <li>The network is a <strong className="text-ink-100">synthetic demo network</strong> of {network.neurons.length} neurons and {network.connections.length} directed connections, generated from simple class-level wiring rules.</li>
              <li>Neuron IDs (VFL-xxxx) are synthetic placeholders. Connection weights are illustrative.</li>
              <li>Switch to the real fruit fly brain with the Brain menu in the top bar.</li>
            </ul>
          )}
        </section>

        <section>
          <h3 className="panel-title mb-1.5">How each neuron is simulated</h3>
          <pre className="overflow-x-auto rounded border border-ink-800 bg-ink-950 px-3 py-2 font-mono text-[13px] text-ink-200">
{`τm · dV/dt = −(V − V_rest) + I_exc − I_inh + I_ext
dI_exc/dt  = −I_exc / τ_exc      dI_inh/dt = −I_inh / τ_inh
if V ≥ V_th:  spike, V ← V_reset, hold for t_ref`}
          </pre>
          <p className="mt-2 text-ink-300">
            Forward-Euler integration with the selected time step. Default neuron parameters: V_rest <span className="num">{p.vRest}</span> mV, V_th{' '}
            <span className="num">{p.vThreshold}</span> mV, V_reset <span className="num">{p.vReset}</span> mV, τm <span className="num">{p.tauM}</span> ms, t_ref{' '}
            <span className="num">{p.refractoryMs}</span> ms (some classes override τm or V_th). Synapses: τ_exc <span className="num">{syn.tauSynExcMs}</span> ms, τ_inh{' '}
            <span className="num">{syn.tauSynInhMs}</span> ms, transmission delay <span className="num">{syn.delayMs}</span> ms.
          </p>
          <p className="mt-2 text-ink-300">
            A presynaptic spike adds the connection weight (mV) to the postsynaptic drive. With default time constants one unit of excitatory weight produces a peak
            PSP of about <span className="num">{pspPerUnit.toFixed(2)}</span> mV.
          </p>
        </section>

        <section>
          <h3 className="panel-title mb-1.5">Background noise and repeatability</h3>
          <p className="text-ink-300">
            Each neuron receives Poisson background events (class-specific rate, weight <span className="num">{syn.backgroundWeight}</span> mV) from a seeded
            pseudo-random generator. Random numbers are drawn in a fixed order regardless of network state, so a baseline and an intervention run with the same seed
            and time step receive identical background input. Identical settings always produce identical results.
          </p>
        </section>

        <section>
          <h3 className="panel-title mb-1.5">Excite and suppress</h3>
          <ul className="list-disc space-y-1 pl-4 text-ink-300">
            <li><strong className="text-ink-100">Excite</strong>: a constant depolarising current I_ext = +intensity is applied to the target during the stimulation window.</li>
            <li><strong className="text-ink-100">Suppress</strong>: a constant hyperpolarising current I_ext = −intensity is applied instead. This reduces excitability; strong synaptic input can still drive spikes.</li>
            <li>Neither mode models opsin kinetics, light delivery, or other properties of real optogenetic tools.</li>
          </ul>
        </section>

        <section>
          <h3 className="panel-title mb-1.5">Reading the results</h3>
          <p className="text-ink-300">
            Differences are raw spike-count differences between two deterministic runs. No statistical test is performed, so no change is labelled significant.
            Simulations run in a Web Worker in your browser; nothing is sent to a server.
          </p>
        </section>
      </div>
    </dialog>
  );
});
