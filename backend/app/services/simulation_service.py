from typing import Tuple
from app.schemas.network import NetworkDefinitionSchema
from app.schemas.simulation import (
    ComparisonSummarySchema,
    SimulationConfigSchema,
    SimulationResultSchema,
    StimulusSchema,
)
from app.schemas.experiment import ExperimentConfigSchema
from app.simulation.comparison import compare_results
from app.simulation.interventions import validate_intervention
from app.simulation.lif import run_lif_simulation


class SimulationService:
    @staticmethod
    def run_matched_experiment(
        config: ExperimentConfigSchema,
        network: NetworkDefinitionSchema,
    ) -> Tuple[SimulationResultSchema, SimulationResultSchema, ComparisonSummarySchema]:
        """Execute a matched pair of simulations (Baseline and Intervention) under identical seed.

        1. Run baseline: same duration, dt, and seed with stimulus=None.
        2. Run intervention: same parameters with configured stimulus applied.
        3. Compute delta metrics and descriptive statements.
        """
        # Validate intervention
        stim = StimulusSchema(
            neuron_id=config.target_neuron_id,
            mode=config.mode,
            start_ms=config.stim_start_ms,
            duration_ms=config.stim_duration_ms,
            intensity=config.intensity,
        )
        errors = validate_intervention(stim, config.duration_ms, network)
        if errors:
            raise ValueError(f"Invalid intervention configuration: {errors}")

        # Baseline config
        baseline_sim_config = SimulationConfigSchema(
            duration_ms=config.duration_ms,
            dt=config.dt,
            seed=config.seed,
            stimulus=None,
            record_voltage=config.record_voltage,
            voltage_neuron_ids=[config.target_neuron_id],
        )

        # Intervention config
        intervention_sim_config = SimulationConfigSchema(
            duration_ms=config.duration_ms,
            dt=config.dt,
            seed=config.seed,
            stimulus=stim,
            record_voltage=config.record_voltage,
            voltage_neuron_ids=[config.target_neuron_id],
        )

        # Execute both runs
        baseline_res = run_lif_simulation(baseline_sim_config, network)
        intervention_res = run_lif_simulation(intervention_sim_config, network)

        # Compute comparative metrics
        summary = compare_results(baseline_res, intervention_res, network, config.output_population_id)

        return baseline_res, intervention_res, summary
