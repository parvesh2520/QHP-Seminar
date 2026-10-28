from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.simulation import ComparisonSummarySchema, InterventionMode, SimulationResultSchema

RunStatus = Literal["pending", "running", "completed", "failed"]


class ExperimentConfigSchema(BaseModel):
    network_id: str = Field("synthetic-fly-v1", alias="networkId", description="Target network ID")
    target_neuron_id: str = Field(..., alias="targetNeuronId", description="Neuron to stimulate or suppress")
    mode: InterventionMode = Field("excite", description="Intervention type ('excite' or 'suppress')")
    stim_start_ms: float = Field(200.0, alias="stimStartMs", ge=0.0, description="Start time in ms")
    stim_duration_ms: float = Field(300.0, alias="stimDurationMs", gt=0.0, description="Duration in ms")
    intensity: float = Field(30.0, ge=0.0, description="Drive intensity (mV-equivalent)")
    duration_ms: float = Field(800.0, alias="durationMs", gt=0.0, le=5000.0, description="Total simulation length in ms")
    dt: float = Field(0.1, ge=0.01, le=0.5, description="Time step in ms")
    output_population_id: str = Field("pop-descending", alias="outputPopulationId", description="Output population ID for delta measurement")
    seed: int = Field(1, description="Deterministic seed")
    record_voltage: bool = Field(True, alias="recordVoltage", description="Whether to record voltage traces")

    model_config = ConfigDict(populate_by_name=True)


class ExperimentCreateSchema(ExperimentConfigSchema):
    pass


class ExperimentRecordSchema(BaseModel):
    id: str
    network_id: str = Field(..., alias="networkId")
    status: RunStatus
    created_at: int = Field(..., alias="createdAt", description="Unix epoch timestamp in milliseconds")
    completed_at: Optional[int] = Field(None, alias="completedAt")
    config: ExperimentConfigSchema
    summary: Optional[ComparisonSummarySchema] = None
    error: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class ExperimentDetailSchema(ExperimentRecordSchema):
    baseline: Optional[SimulationResultSchema] = None
    intervention: Optional[SimulationResultSchema] = None


class ExperimentListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ExperimentRecordSchema]
