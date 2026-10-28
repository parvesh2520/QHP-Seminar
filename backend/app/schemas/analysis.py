from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.simulation import InterventionMode


class CandidateScreeningRequest(BaseModel):
    network_id: str = Field("synthetic-fly-v1", alias="networkId")
    candidate_ids: List[str] = Field(..., alias="candidateIds", description="List of neuron IDs to screen")
    output_population_id: str = Field("pop-descending", alias="outputPopulationId", description="Target output group to monitor")
    mode: InterventionMode = Field("excite", description="Intervention mode ('excite' or 'suppress')")
    stim_start_ms: float = Field(200.0, alias="stimStartMs", ge=0.0)
    stim_duration_ms: float = Field(300.0, alias="stimDurationMs", gt=0.0)
    intensity: float = Field(30.0, ge=0.0)
    duration_ms: float = Field(800.0, alias="durationMs", gt=0.0, le=5000.0)
    dt: float = Field(0.1, ge=0.01, le=0.5)
    seed: int = Field(1)

    model_config = ConfigDict(populate_by_name=True)


class CandidateResultSchema(BaseModel):
    neuron_id: str = Field(..., alias="neuronId")
    baseline_output: int = Field(..., alias="baselineOutput")
    intervention_output: int = Field(..., alias="interventionOutput")
    delta: int = Field(..., description="Intervention minus Baseline output spike count")
    abs_delta: int = Field(..., alias="absDelta", description="Absolute magnitude |delta| for ranking")
    percent_change: Optional[float] = Field(None, alias="percentChange")
    total_delta: int = Field(..., alias="totalDelta", description="Overall network spike difference")
    status: str = "completed"

    model_config = ConfigDict(populate_by_name=True)


class ScreeningResponseSchema(BaseModel):
    network_id: str = Field(..., alias="networkId")
    output_population_id: str = Field(..., alias="outputPopulationId")
    ranking_metric: str = "absolute_output_spike_change"
    metric_definition: str = "|Spikes(intervention, output) - Spikes(baseline, output)|"
    total_candidates: int = Field(..., alias="totalCandidates")
    results: List[CandidateResultSchema]
    wall_time_ms: float = Field(..., alias="wallTimeMs")

    model_config = ConfigDict(populate_by_name=True)
