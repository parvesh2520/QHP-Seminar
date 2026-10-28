from typing import List
from app.schemas.network import NetworkDefinitionSchema
from app.schemas.simulation import (
    ComparisonSummarySchema,
    NeuronDeltaSchema,
    PopulationDeltaSchema,
    SimulationResultSchema,
)
from app.simulation.metrics import calculate_population_metrics, percent_change


def describe_change(label: str, baseline: int, intervention: int) -> str:
    delta = intervention - baseline
    if delta == 0:
        return f"{label}: unchanged ({baseline} spikes)."
    pct = percent_change(float(baseline), float(intervention))
    pct_text = "from zero" if pct is None else f"{'+' if pct > 0 else ''}{pct:.1f}%"
    sign = "+" if delta > 0 else ""
    direction = "increased" if delta > 0 else "decreased"
    return f"{label} {direction} from {baseline} to {intervention} spikes ({sign}{delta}, {pct_text})."


def compare_results(
    baseline: SimulationResultSchema,
    intervention: SimulationResultSchema,
    network: NetworkDefinitionSchema,
    output_population_id: str,
) -> ComparisonSummarySchema:
    """Compare a baseline run with an intervention run under identical seed and parameters."""
    if len(baseline.spike_counts) != len(intervention.spike_counts):
        raise ValueError("Baseline and intervention results come from networks of different size")

    b_metrics = calculate_population_metrics(baseline, network)
    v_metrics = calculate_population_metrics(intervention, network)

    pop_map = {p.id: p for p in network.populations}
    if output_population_id not in pop_map:
        raise ValueError(f"Unknown output population '{output_population_id}'")

    populations: List[PopulationDeltaSchema] = []
    for p in network.populations:
        b_spikes = b_metrics.population_spikes.get(p.id, 0)
        v_spikes = v_metrics.population_spikes.get(p.id, 0)
        delta = v_spikes - b_spikes
        pct = percent_change(float(b_spikes), float(v_spikes))
        populations.append(
            PopulationDeltaSchema(
                population_id=p.id,
                label=p.label,
                baseline=b_spikes,
                intervention=v_spikes,
                delta=delta,
                percent_change=pct,
            )
        )

    output_delta = next(p for p in populations if p.population_id == output_population_id)

    # Per-neuron deltas
    neuron_deltas: List[NeuronDeltaSchema] = []
    for n, b_cnt, v_cnt in zip(network.neurons, baseline.spike_counts, intervention.spike_counts):
        d = v_cnt - b_cnt
        if d != 0:
            neuron_deltas.append(NeuronDeltaSchema(neuron_id=n.id, baseline=b_cnt, intervention=v_cnt, delta=d))

    neuron_deltas.sort(key=lambda x: (abs(x.delta), x.neuron_id), reverse=True)

    # Descriptive summary statements
    statements: List[str] = [
        describe_change("Total network activity", b_metrics.total_spikes, v_metrics.total_spikes),
        describe_change(f"Output population ({output_delta.label})", output_delta.baseline, output_delta.intervention),
    ]

    active_diff = v_metrics.active_neurons - b_metrics.active_neurons
    if active_diff == 0:
        statements.append(f"Number of active neurons unchanged ({b_metrics.active_neurons}).")
    else:
        direction = "increased" if active_diff > 0 else "decreased"
        statements.append(
            f"Number of active neurons {direction} from {b_metrics.active_neurons} to {v_metrics.active_neurons}."
        )

    up_count = sum(1 for d in neuron_deltas if d.delta > 0)
    down_count = sum(1 for d in neuron_deltas if d.delta < 0)
    statements.append(f"{up_count} neuron(s) fired more and {down_count} fired less than in the baseline run.")

    total_delta = v_metrics.total_spikes - b_metrics.total_spikes
    total_pct = percent_change(float(b_metrics.total_spikes), float(v_metrics.total_spikes))

    return ComparisonSummarySchema(
        baseline=b_metrics,
        intervention=v_metrics,
        total_spikes={
            "baseline": b_metrics.total_spikes,
            "intervention": v_metrics.total_spikes,
            "delta": total_delta,
            "percentChange": total_pct,
        },
        active_neurons={
            "baseline": b_metrics.active_neurons,
            "intervention": v_metrics.active_neurons,
            "delta": active_diff,
        },
        output=output_delta,
        populations=populations,
        neuron_deltas=neuron_deltas,
        statements=statements,
    )
