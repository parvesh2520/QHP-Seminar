import math
from typing import Dict, Optional, Set
import numpy as np
from app.schemas.network import NetworkDefinitionSchema
from app.schemas.simulation import PopulationMetricsSchema, SimulationResultSchema


def percent_change(baseline: float, intervention: float) -> Optional[float]:
    """Calculate relative percent change with safe zero-denominator handling."""
    if baseline == 0:
        return None
    return round(((intervention - baseline) / baseline) * 100.0, 2)


def calculate_population_metrics(
    result: SimulationResultSchema,
    network: NetworkDefinitionSchema,
    bin_width_ms: float = 10.0,
    filter_indices: Optional[Set[int]] = None,
) -> PopulationMetricsSchema:
    """Calculate aggregate and population-specific firing statistics."""
    N = len(network.neurons)
    duration_s = result.config.duration_ms / 1000.0
    index_by_id = {n.id: i for i, n in enumerate(network.neurons)}

    # Total spikes
    if filter_indices is not None:
        filtered_spikes = [
            t for t, i in zip(result.spike_times, result.spike_neurons) if i in filter_indices
        ]
        total_spikes = len(filtered_spikes)
        active_neurons = len({i for i in result.spike_neurons if i in filter_indices})
    else:
        filtered_spikes = result.spike_times
        total_spikes = len(result.spike_times)
        active_neurons = int(np.count_nonzero(result.spike_counts))

    mean_rate_hz = round(total_spikes / (max(1, len(filter_indices) if filter_indices else N) * duration_s), 2)

    # Population spikes
    pop_spikes: Dict[str, int] = {}
    for p in network.populations:
        indices = [index_by_id[nid] for nid in p.neuron_ids if nid in index_by_id]
        pop_spikes[p.id] = int(sum(result.spike_counts[i] for i in indices))

    # Binned time histogram
    bin_count = max(1, int(math.ceil(result.config.duration_ms / bin_width_ms)))
    bin_starts = [round(k * bin_width_ms, 2) for k in range(bin_count)]
    binned_counts = [0] * bin_count

    for t in filtered_spikes:
        idx = int(t / bin_width_ms)
        if 0 <= idx < bin_count:
            binned_counts[idx] += 1

    return PopulationMetricsSchema(
        total_spikes=total_spikes,
        active_neurons=active_neurons,
        mean_rate_hz=mean_rate_hz,
        population_spikes=pop_spikes,
        bin_width_ms=bin_width_ms,
        bin_starts=bin_starts,
        binned_counts=binned_counts,
    )
