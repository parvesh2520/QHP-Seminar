import type { LIFParams, SynapseParams } from '../types/network';

/**
 * Toy leaky integrate-and-fire model.
 *
 * Membrane dynamics (forward Euler, step dt):
 *   tauM * dV/dt = -(V - vRest) + Iexc - Iinh + Iext
 * Synaptic drives decay exponentially:
 *   dIexc/dt = -Iexc / tauSynExc,   dIinh/dt = -Iinh / tauSynInh
 * A presynaptic spike adds its connection weight to the postsynaptic drive
 * after a fixed delay. Drives are expressed in mV (voltage-equivalent), so a
 * steady drive of D mV shifts the steady-state potential by D mV.
 *
 * All values are illustrative toy parameters chosen to give interpretable
 * activity in the synthetic network. They are NOT calibrated to Drosophila.
 */
export const DEFAULT_LIF_PARAMS: LIFParams = {
  vRest: -65,
  vThreshold: -50,
  vReset: -68,
  tauM: 15,
  refractoryMs: 2,
};

export const DEFAULT_SYNAPSE_PARAMS: SynapseParams = {
  tauSynExcMs: 5,
  tauSynInhMs: 10,
  delayMs: 1,
  backgroundWeight: 6,
};

/** Approximate peak PSP (mV) produced by a single synaptic event of weight w. */
export function peakPspForWeight(weight: number, tauM: number, tauSyn: number): number {
  if (Math.abs(tauM - tauSyn) < 1e-9) return (weight * Math.exp(-1)); // limit case tauM == tauSyn
  const tPeak = (Math.log(tauM / tauSyn) * tauM * tauSyn) / (tauM - tauSyn);
  return ((weight * tauSyn) / (tauM - tauSyn)) * (Math.exp(-tPeak / tauM) - Math.exp(-tPeak / tauSyn));
}
