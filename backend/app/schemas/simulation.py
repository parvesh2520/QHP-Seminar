from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

InterventionMode = Literal["excite", "suppress"]


class StimulusSchema(BaseModel):
    neuron_id: str = Field(..., alias="neuronId", description="Target neuron ID")
    mode: InterventionMode = Field(..., description="Intervention mode ('excite' or 'suppress')")
    start_ms: float = Field(..., alias="startMs", ge=0.0, description="Onset time (ms)")
    duration_ms: float = Field(..., alias="durationMs", gt=0.0, description="Intervention duration (ms)")
    intensity: float = Field(..., ge=0.0, description="Magnitude of current injection (mV-equivalent)")

    model_config = ConfigDict(populate_by_name=True)


class SimulationConfigSchema(BaseModel):
    duration_ms: float = Field(800.0, alias="durationMs", gt=0.0, le=5000.0, description="Total simulation length (ms)")
    dt: float = Field(0.1, ge=0.01, le=0.5, description="Forward Euler integration time step (ms)")
    seed: int = Field(1, description="PRNG seed for deterministic reproducible execution")
    stimulus: Optional[StimulusSchema] = None
    record_voltage: bool = Field(True, alias="recordVoltage", description="Whether to record downsampled membrane voltage traces")
    voltage_neuron_ids: Optional[List[str]] = Field(None, alias="voltageNeuronIds", description="Specific neuron IDs to record; if None, records target / default sample")

    model_config = ConfigDict(populate_by_name=True)


class SimulationResultSchema(BaseModel):
    config: SimulationConfigSchema
    neuron_ids: List[str] = Field(..., alias="neuronIds")
    spike_times: List[float] = Field(..., alias="spikeTimes", description="Array of all spike timestamps in ms")
    spike_neurons: List[int] = Field(..., alias="spikeNeurons", description="Neuron index for each spike timestamp")
    spike_counts: List[int] = Field(..., alias="spikeCounts", description="Total spike count per neuron")
    sample_count: int = Field(0, alias="sampleCount")
    sample_interval_ms: float = Field(1.0, alias="sampleIntervalMs")
    wall_time_ms: float = Field(0.0, alias="wallTimeMs")
    voltage_traces: Optional[Dict[str, List[float]]] = Field(default=None, alias="voltageTraces", description="Neuron ID -> list of voltage samples in mV")
    voltage_time_points: Optional[List[float]] = Field(default=None, alias="voltageTimePoints", description="Timestamp for each voltage sample in ms")

    model_config = ConfigDict(populate_by_name=True)


class PopulationMetricsSchema(BaseModel):
    total_spikes: int = Field(..., alias="totalSpikes")
    active_neurons: int = Field(..., alias="activeNeurons")
    mean_rate_hz: float = Field(..., alias="meanRateHz")
    population_spikes: Dict[str, int] = Field(..., alias="populationSpikes")
    bin_width_ms: float = Field(10.0, alias="binWidthMs")
    bin_starts: List[float] = Field(..., alias="binStarts")
    binned_counts: List[int] = Field(..., alias="binnedCounts")

    model_config = ConfigDict(populate_by_name=True)


class PopulationDeltaSchema(BaseModel):
    population_id: str = Field(..., alias="populationId")
    label: str
    baseline: int
    intervention: int
    delta: int
    percent_change: Optional[float] = Field(None, alias="percentChange")

    model_config = ConfigDict(populate_by_name=True)


class NeuronDeltaSchema(BaseModel):
    neuron_id: str = Field(..., alias="neuronId")
    baseline: int
    intervention: int
    delta: int

    model_config = ConfigDict(populate_by_name=True)


class ComparisonSummarySchema(BaseModel):
    baseline: PopulationMetricsSchema
    intervention: PopulationMetricsSchema
    total_spikes: Dict[str, Any] = Field(..., alias="totalSpikes")
    active_neurons: Dict[str, Any] = Field(..., alias="activeNeurons")
    output: PopulationDeltaSchema
    populations: List[PopulationDeltaSchema]
    neuron_deltas: List[NeuronDeltaSchema] = Field(..., alias="neuronDeltas")
    statements: List[str]

    model_config = ConfigDict(populate_by_name=True)
