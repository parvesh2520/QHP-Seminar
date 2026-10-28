from typing import Any, Dict, List, Literal
from pydantic import BaseModel, ConfigDict, Field

ConnectionType = Literal["excitatory", "inhibitory"]
Hemisphere = Literal["L", "R"]


class LIFParamsSchema(BaseModel):
    """Leaky integrate-and-fire biophysical toy parameters."""
    v_rest: float = Field(-65.0, alias="vRest", description="Resting membrane potential (mV)")
    v_threshold: float = Field(-50.0, alias="vThreshold", description="Action potential firing threshold (mV)")
    v_reset: float = Field(-68.0, alias="vReset", description="Post-spike reset potential (mV)")
    tau_m: float = Field(15.0, alias="tauM", description="Membrane time constant (ms)")
    refractory_ms: float = Field(2.0, alias="refractoryMs", description="Absolute refractory period (ms)")

    model_config = ConfigDict(populate_by_name=True)


class NeuronClassSchema(BaseModel):
    """Categorical class or functional grouping of neurons."""
    id: str
    label: str
    description: str
    transmitter: ConnectionType
    color: str

    model_config = ConfigDict(populate_by_name=True)


class NeuronBaseSchema(BaseModel):
    """Base neuron definition."""
    id: str = Field(..., description="Stable, unique neuron identifier")
    label: str = Field(..., description="Human-readable label")
    class_id: str = Field(..., alias="classId", description="Class ID")
    hemisphere: Hemisphere = Field("L", description="Hemisphere location (L or R)")
    position: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0], description="Spatial layout coordinates [x, y, z]")
    params: LIFParamsSchema = Field(default_factory=LIFParamsSchema)
    background_rate_hz: float = Field(250.0, alias="backgroundRateHz", description="Tonic Poisson background input rate (Hz)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary structured metadata")

    model_config = ConfigDict(populate_by_name=True)


class NeuronSchema(NeuronBaseSchema):
    pass


class NeuronDetailSchema(NeuronSchema):
    """Detailed neuron view including connectivity counts and group memberships."""
    incoming_count: int = 0
    outgoing_count: int = 0
    populations: List[str] = Field(default_factory=list)


class NeuronListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[NeuronDetailSchema]
