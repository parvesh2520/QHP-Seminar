from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.neuron import ConnectionType, NeuronClassSchema, NeuronSchema


class ConnectionSchema(BaseModel):
    """Directed connection between pre- and post-synaptic neurons."""
    source_id: str = Field(..., alias="pre", description="Presynaptic neuron ID")
    target_id: str = Field(..., alias="post", description="Postsynaptic neuron ID")
    weight: float = Field(..., ge=0.0, description="Synaptic weight / drive increment (mV)")
    connection_type: ConnectionType = Field("excitatory", alias="type", description="Synapse transmission type")
    synapse_count: Optional[int] = Field(None, alias="synapseCount", ge=0, description="Optional physical synapse count")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)


class PopulationSchema(BaseModel):
    """Functional population or anatomical sub-circuit."""
    id: str
    label: str
    description: str
    role: Literal["input", "internal", "output"]
    neuron_ids: List[str] = Field(..., alias="neuronIds")

    model_config = ConfigDict(populate_by_name=True)


class SynapseParamsSchema(BaseModel):
    """Network-wide synapse dynamics and background drive parameters."""
    tau_syn_exc_ms: float = Field(5.0, alias="tauSynExcMs", description="Excitatory decay constant (ms)")
    tau_syn_inh_ms: float = Field(10.0, alias="tauSynInhMs", description="Inhibitory decay constant (ms)")
    delay_ms: float = Field(1.0, alias="delayMs", description="Synaptic transmission delay (ms)")
    background_weight: float = Field(6.0, alias="backgroundWeight", description="Drive added per background event (mV)")

    model_config = ConfigDict(populate_by_name=True)


class NetworkMetadataSchema(BaseModel):
    id: str = Field("synthetic-fly-v1", description="Dataset identifier")
    name: str = Field("Synthetic demo network", description="Human-readable network title")
    source: str = Field("synthetic", description="Data provenance (synthetic or connectome-subset)")
    description: str = Field("Rule-generated toy network loosely inspired by insect sensory-integrative circuits")
    version: str = Field("1.0.0")
    is_synthetic: bool = Field(True, alias="isSynthetic", description="Whether this network is synthetic or real biology")

    model_config = ConfigDict(populate_by_name=True)


class NetworkSummarySchema(BaseModel):
    id: str
    metadata: NetworkMetadataSchema
    neuron_count: int
    connection_count: int
    class_counts: Dict[str, int]
    population_counts: Dict[str, int]
    synapse: SynapseParamsSchema


class NetworkDefinitionSchema(BaseModel):
    """Full network definition required by frontend."""
    metadata: NetworkMetadataSchema
    classes: List[NeuronClassSchema]
    neurons: List[NeuronSchema]
    connections: List[ConnectionSchema]
    populations: List[PopulationSchema]
    synapse: SynapseParamsSchema

    model_config = ConfigDict(populate_by_name=True)


class SubgraphRequestSchema(BaseModel):
    neuron_ids: List[str] = Field(..., description="Root seed neuron IDs to expand around")
    depth: int = Field(1, ge=1, le=4, description="Neighborhood traversal depth (1 to 4)")
    limit_nodes: int = Field(150, ge=1, le=500, description="Maximum nodes to return")
    limit_edges: int = Field(600, ge=1, le=2000, description="Maximum edges to return")
    direction: Literal["both", "incoming", "outgoing"] = "both"


class SubgraphResponseSchema(BaseModel):
    nodes: List[NeuronSchema]
    edges: List[ConnectionSchema]
    depth: int
    truncated: bool
    total_nodes_in_neighborhood: int
    total_edges_in_neighborhood: int


class DatasetItemSchema(BaseModel):
    id: str
    name: str
    source: str
    description: str
    version: str
    is_synthetic: bool
    neuron_count: int
    connection_count: int
    created_at: Optional[str] = None
