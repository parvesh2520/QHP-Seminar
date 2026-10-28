import time
from typing import List
from sqlalchemy.orm import Session
from app.db.repository import NetworkRepository
from app.schemas.analysis import (
    CandidateResultSchema,
    CandidateScreeningRequest,
    ScreeningResponseSchema,
)
from app.schemas.simulation import SimulationConfigSchema, StimulusSchema
from app.simulation.lif import run_lif_simulation
from app.simulation.metrics import percent_change


class AnalysisService:
    @staticmethod
    def screen_candidates(db: Session, req: CandidateScreeningRequest) -> ScreeningResponseSchema:
        wall_start = time.perf_counter()

        net_def = NetworkRepository.get_network_definition(db, req.network_id)
        if not net_def:
            raise ValueError(f"Network '{req.network_id}' not found")

        pop_map = {p.id: p for p in net_def.populations}
        if req.output_population_id not in pop_map:
            raise ValueError(f"Output population '{req.output_population_id}' not found in network")

        output_pop = pop_map[req.output_population_id]
        output_indices = [
            i for i, n in enumerate(net_def.neurons) if n.id in output_pop.neuron_ids
        ]

        if not req.candidate_ids:
            raise ValueError("Candidate ID list cannot be empty")

        # 1. Shared Baseline Run (without recording voltage to keep screen fast)
        baseline_cfg = SimulationConfigSchema(
            duration_ms=req.duration_ms,
            dt=req.dt,
            seed=req.seed,
            stimulus=None,
            record_voltage=False,
        )
        baseline_res = run_lif_simulation(baseline_cfg, net_def)
        baseline_output_spikes = sum(baseline_res.spike_counts[i] for i in output_indices)
        baseline_total_spikes = len(baseline_res.spike_times)

        # 2. Perturbation Screen for each candidate
        results: List[CandidateResultSchema] = []

        for cid in req.candidate_ids:
            stim = StimulusSchema(
                neuron_id=cid,
                mode=req.mode,
                start_ms=req.stim_start_ms,
                duration_ms=req.stim_duration_ms,
                intensity=req.intensity,
            )
            sim_cfg = SimulationConfigSchema(
                duration_ms=req.duration_ms,
                dt=req.dt,
                seed=req.seed,
                stimulus=stim,
                record_voltage=False,
            )
            res = run_lif_simulation(sim_cfg, net_def)
            intervention_output_spikes = sum(res.spike_counts[i] for i in output_indices)
            delta = intervention_output_spikes - baseline_output_spikes
            abs_delta = abs(delta)
            pct = percent_change(float(baseline_output_spikes), float(intervention_output_spikes))
            total_delta = len(res.spike_times) - baseline_total_spikes

            results.append(
                CandidateResultSchema(
                    neuron_id=cid,
                    baseline_output=baseline_output_spikes,
                    intervention_output=intervention_output_spikes,
                    delta=delta,
                    abs_delta=abs_delta,
                    percent_change=pct,
                    total_delta=total_delta,
                    status="completed",
                )
            )

        # 3. Sort by absolute delta descending, then neuron ID ascending
        results.sort(key=lambda r: (-r.abs_delta, r.neuron_id))

        wall_time_ms = round((time.perf_counter() - wall_start) * 1000.0, 2)

        return ScreeningResponseSchema(
            network_id=req.network_id,
            output_population_id=req.output_population_id,
            ranking_metric="absolute_output_spike_change",
            metric_definition=f"|OutputSpikes({output_pop.label}, intervention) - OutputSpikes({output_pop.label}, baseline)|",
            total_candidates=len(results),
            results=results,
            wall_time_ms=wall_time_ms,
        )
