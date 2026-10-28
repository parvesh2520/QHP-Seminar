import math
from typing import Dict, List
import numpy as np
from app.schemas.network import (
    ConnectionSchema,
    NetworkDefinitionSchema,
    NetworkMetadataSchema,
    PopulationSchema,
    SynapseParamsSchema,
)
from app.schemas.neuron import LIFParamsSchema, NeuronClassSchema, NeuronSchema

NETWORK_SEED = 20240611

CLASS_SPECS = [
    {
        "id": "SEN",
        "label": "Sensory afferent",
        "transmitter": "excitatory",
        "color": "#3987e5",
        "description": "Input neurons receiving tonic background drive; entry point of the network.",
        "per_side": 12,
        "center": [-2.3, -1.2, 1.4],
        "spread": [0.45, 0.35, 0.35],
        "params": {"tau_m": 10.0},
        "background_rate_hz": 450.0,
    },
    {
        "id": "PN",
        "label": "Projection neuron",
        "transmitter": "excitatory",
        "color": "#d95926",
        "description": "Relay sensory activity to integrative and convergence layers.",
        "per_side": 8,
        "center": [-1.7, -0.5, 0.7],
        "spread": [0.3, 0.3, 0.3],
        "params": {},
        "background_rate_hz": 280.0,
    },
    {
        "id": "LN",
        "label": "Local interneuron",
        "transmitter": "inhibitory",
        "color": "#199e70",
        "description": "Inhibitory interneurons providing lateral inhibition onto projection neurons.",
        "per_side": 6,
        "center": [-2.0, -0.9, 0.2],
        "spread": [0.3, 0.25, 0.3],
        "params": {"tau_m": 12.0},
        "background_rate_hz": 250.0,
    },
    {
        "id": "INT",
        "label": "Integrative interneuron",
        "transmitter": "excitatory",
        "color": "#c98500",
        "description": "Sparse, convergent layer that pools projection-neuron input.",
        "per_side": 16,
        "center": [-1.3, 0.9, -0.2],
        "spread": [0.5, 0.35, 0.45],
        "params": {"tau_m": 18.0, "v_threshold": -48.0},
        "background_rate_hz": 280.0,
    },
    {
        "id": "FBI",
        "label": "Feedback inhibitory",
        "transmitter": "inhibitory",
        "color": "#d55181",
        "description": "Pools integrative activity and feeds inhibition back onto it (gain control).",
        "per_side": 2,
        "center": [-0.7, 1.4, 0.3],
        "spread": [0.15, 0.15, 0.15],
        "params": {"tau_m": 12.0},
        "background_rate_hz": 250.0,
    },
    {
        "id": "CON",
        "label": "Convergence neuron",
        "transmitter": "excitatory",
        "color": "#008300",
        "description": "Read out integrative-layer activity and drive descending pathways.",
        "per_side": 4,
        "center": [-0.8, 0.2, -0.8],
        "spread": [0.2, 0.25, 0.2],
        "params": {},
        "background_rate_hz": 330.0,
    },
    {
        "id": "DN",
        "label": "Descending neuron",
        "transmitter": "excitatory",
        "color": "#9085e9",
        "description": "Output population: carries activity toward (simulated) motor circuits.",
        "per_side": 5,
        "center": [-0.35, -0.9, -1.1],
        "spread": [0.15, 0.3, 0.2],
        "params": {},
        "background_rate_hz": 330.0,
    },
    {
        "id": "PMN",
        "label": "Premotor neuron",
        "transmitter": "excitatory",
        "color": "#e66767",
        "description": "Output population downstream of descending neurons.",
        "per_side": 6,
        "center": [-0.6, -2.3, -1.4],
        "spread": [0.25, 0.2, 0.25],
        "params": {"tau_m": 12.0},
        "background_rate_hz": 300.0,
    },
]

CONNECTION_RULES = [
    {"pre": "SEN", "post": "PN", "p_ipsi": 0.30, "p_contra": 0.00, "weight": 16.0},
    {"pre": "SEN", "post": "LN", "p_ipsi": 0.30, "p_contra": 0.00, "weight": 12.0},
    {"pre": "LN", "post": "PN", "p_ipsi": 0.50, "p_contra": 0.00, "weight": 14.0},
    {"pre": "LN", "post": "LN", "p_ipsi": 0.20, "p_contra": 0.00, "weight": 8.0},
    {"pre": "PN", "post": "LN", "p_ipsi": 0.20, "p_contra": 0.00, "weight": 8.0},
    {"pre": "PN", "post": "INT", "p_ipsi": 0.30, "p_contra": 0.04, "weight": 18.0},
    {"pre": "PN", "post": "CON", "p_ipsi": 0.12, "p_contra": 0.00, "weight": 10.0},
    {"pre": "INT", "post": "FBI", "p_ipsi": 0.60, "p_contra": 0.10, "weight": 10.0},
    {"pre": "FBI", "post": "INT", "p_ipsi": 0.60, "p_contra": 0.20, "weight": 12.0},
    {"pre": "INT", "post": "CON", "p_ipsi": 0.35, "p_contra": 0.05, "weight": 16.0},
    {"pre": "CON", "post": "DN", "p_ipsi": 0.45, "p_contra": 0.15, "weight": 18.0},
    {"pre": "CON", "post": "PMN", "p_ipsi": 0.20, "p_contra": 0.00, "weight": 10.0},
    {"pre": "DN", "post": "PMN", "p_ipsi": 0.50, "p_contra": 0.10, "weight": 18.0},
    {"pre": "DN", "post": "DN", "p_ipsi": 0.00, "p_contra": 0.20, "weight": 8.0},
]


def generate_synthetic_network(seed: int = NETWORK_SEED) -> NetworkDefinitionSchema:
    rng = np.random.default_rng(seed)
    neurons: List[NeuronSchema] = []
    by_class_side: Dict[str, List[NeuronSchema]] = {}
    serial = 1

    classes: List[NeuronClassSchema] = []
    for spec in CLASS_SPECS:
        classes.append(
            NeuronClassSchema(
                id=spec["id"],
                label=spec["label"],
                description=spec["description"],
                transmitter=spec["transmitter"],
                color=spec["color"],
            )
        )
        for side in ["L", "R"]:
            neurons_in_group: List[NeuronSchema] = []
            sx = 1.0 if side == "L" else -1.0
            for k in range(spec["per_side"]):
                pos = [
                    round(float(sx * spec["center"][0] + rng.normal(0, 1) * spec["spread"][0]), 3),
                    round(float(spec["center"][1] + rng.normal(0, 1) * spec["spread"][1]), 3),
                    round(float(spec["center"][2] + rng.normal(0, 1) * spec["spread"][2]), 3),
                ]
                params_dict = {"v_rest": -65.0, "v_threshold": -50.0, "v_reset": -68.0, "tau_m": 15.0, "refractory_ms": 2.0}
                params_dict.update(spec["params"])
                neuron = NeuronSchema(
                    id=f"VFL-{serial:04d}",
                    label=f"{spec['id']}-{side}{k + 1:02d}",
                    class_id=spec["id"],
                    hemisphere=side,  # type: ignore
                    position=pos,
                    params=LIFParamsSchema(**params_dict),
                    background_rate_hz=spec["background_rate_hz"],
                    metadata={"synthetic": True, "layer": spec["id"], "hemisphere": side},
                )
                serial += 1
                neurons_in_group.append(neuron)
                neurons.append(neuron)
            by_class_side[f"{spec['id']}:{side}"] = neurons_in_group

    transmitter_map = {c.id: c.transmitter for c in classes}
    connections: List[ConnectionSchema] = []
    seen = set()

    for rule in CONNECTION_RULES:
        for pre_side in ["L", "R"]:
            for post_side in ["L", "R"]:
                p = rule["p_ipsi"] if pre_side == post_side else rule["p_contra"]
                if p <= 0:
                    continue
                pres = by_class_side.get(f"{rule['pre']}:{pre_side}", [])
                posts = by_class_side.get(f"{rule['post']}:{post_side}", [])
                for pre in pres:
                    for post in posts:
                        if pre.id == post.id or rng.random() >= p:
                            continue
                        key = (pre.id, post.id)
                        if key in seen:
                            continue
                        seen.add(key)
                        weight = round(float(rule["weight"] * math.exp(0.25 * rng.normal(0, 1))), 3)
                        connections.append(
                            ConnectionSchema(
                                source_id=pre.id,
                                target_id=post.id,
                                weight=weight,
                                connection_type=transmitter_map[rule["pre"]],  # type: ignore
                                synapse_count=max(1, int(round(weight / 2.0))),
                                metadata={"rule": f"{rule['pre']}->{rule['post']}"},
                            )
                        )

    def ids_of(class_ids: List[str]) -> List[str]:
        return [n.id for n in neurons if n.class_id in class_ids]

    populations: List[PopulationSchema] = [
        PopulationSchema(id="pop-sensory", label="Sensory input", role="input", description="All sensory afferents (SEN).", neuron_ids=ids_of(["SEN"])),
        PopulationSchema(id="pop-relay", label="Relay layer", role="internal", description="Projection neurons and local interneurons (PN, LN).", neuron_ids=ids_of(["PN", "LN"])),
        PopulationSchema(id="pop-integrative", label="Integrative layer", role="internal", description="Integrative and feedback-inhibitory neurons (INT, FBI).", neuron_ids=ids_of(["INT", "FBI"])),
        PopulationSchema(id="pop-convergence", label="Convergence layer", role="internal", description="Convergence neurons (CON).", neuron_ids=ids_of(["CON"])),
        PopulationSchema(id="pop-descending", label="Descending output", role="output", description="Descending neurons (DN).", neuron_ids=ids_of(["DN"])),
        PopulationSchema(id="pop-premotor", label="Premotor output", role="output", description="Premotor neurons (PMN).", neuron_ids=ids_of(["PMN"])),
        PopulationSchema(
            id="pop-descending-left",
            label="Descending output (left)",
            role="output",
            description="Left-hemisphere descending neurons only.",
            neuron_ids=[n.id for n in neurons if n.class_id == "DN" and n.hemisphere == "L"],
        ),
    ]

    return NetworkDefinitionSchema(
        metadata=NetworkMetadataSchema(
            id="synthetic-fly-v1",
            name="Synthetic demo network",
            source="synthetic",
            version="1.0.0",
            is_synthetic=True,
            description="Rule-generated, bilaterally organized toy network (8 classes, 106 neurons). Layout coordinates in arbitrary units; illustrative synaptic weights.",
        ),
        classes=classes,
        neurons=neurons,
        connections=connections,
        populations=populations,
        synapse=SynapseParamsSchema(
            tau_syn_exc_ms=5.0,
            tau_syn_inh_ms=10.0,
            delay_ms=1.0,
            background_weight=6.0,
        ),
    )
