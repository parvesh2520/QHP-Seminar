from typing import Dict
from app.schemas.network import NetworkDefinitionSchema
from app.schemas.simulation import StimulusSchema

PARAM_LIMITS = {
    "intensity": {"min": 0.0, "max": 200.0},
    "duration_ms": {"min": 50.0, "max": 5000.0},
    "stim_start_ms": {"min": 0.0, "max": 5000.0},
    "stim_duration_ms": {"min": 10.0, "max": 5000.0},
}


def validate_intervention(
    stim: StimulusSchema,
    simulation_duration_ms: float,
    network: NetworkDefinitionSchema,
) -> Dict[str, str]:
    """Validate intervention configuration against physical/numerical safety constraints."""
    errors: Dict[str, str] = {}

    neuron_ids = {n.id for n in network.neurons}
    if stim.neuron_id not in neuron_ids:
        errors["neuron_id"] = f"Target neuron '{stim.neuron_id}' does not exist in the network"

    if stim.intensity < PARAM_LIMITS["intensity"]["min"] or stim.intensity > PARAM_LIMITS["intensity"]["max"]:
        errors["intensity"] = f"Intensity must be between {PARAM_LIMITS['intensity']['min']} and {PARAM_LIMITS['intensity']['max']} mV"

    if stim.start_ms < 0:
        errors["start_ms"] = "Start time cannot be negative"

    if stim.duration_ms <= 0:
        errors["duration_ms"] = "Duration must be greater than zero"

    if (stim.start_ms + stim.duration_ms) > simulation_duration_ms:
        errors["window"] = f"Intervention window ({stim.start_ms} to {stim.start_ms + stim.duration_ms} ms) extends beyond total simulation length ({simulation_duration_ms} ms)"

    return errors
