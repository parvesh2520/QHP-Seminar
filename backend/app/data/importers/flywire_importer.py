import csv
import io
import math
from typing import Dict, List, Set
from app.data.importers.base import BaseConnectomeImporter, ImportValidationResult, ValidationIssue
from app.schemas.network import (
    ConnectionSchema,
    NetworkDefinitionSchema,
    NetworkMetadataSchema,
    PopulationSchema,
    SynapseParamsSchema,
)
from app.schemas.neuron import LIFParamsSchema, NeuronClassSchema, NeuronSchema

FLYWIRE_PALETTE = {
    "AL": "#3987e5",  # Antennal Lobe
    "MB": "#c98500",  # Mushroom Body
    "LH": "#199e70",  # Lateral Horn
    "CX": "#9085e9",  # Central Complex
    "OL": "#d95926",  # Optic Lobe
    "SMP": "#d55181", # Superior Medial Protocerebrum
    "VNC": "#e66767", # Ventral Nerve Cord Descending
    "UNC": "#8a8e95", # Unclassified
}


class FlyWireConnectomeImporter(BaseConnectomeImporter):
    """Modular importer for validated FlyWire connectome subsets.

    Note on Scientific Validity:
    - Preserves FlyWire 64-bit root IDs.
    - Physical synapse count is kept explicit in `synapse_count`.
    - Synaptic weights in the toy LIF model default to a scaled monotonic function of synapse count,
      explicitly documented as an uncalibrated proxy rather than measured biophysical conductances.
    """

    def validate(
        self,
        neurons_csv_text: str,
        synapses_csv_text: str,
        dataset_id: str,
    ) -> ImportValidationResult:
        issues: List[ValidationIssue] = []
        neuron_ids: Set[str] = set()

        n_reader = csv.DictReader(io.StringIO(neurons_csv_text))
        required_cols = {"root_id"}
        if not n_reader.fieldnames or not required_cols.issubset(set(n_reader.fieldnames)):
            issues.append(
                ValidationIssue(
                    level="error",
                    message="Neurons CSV must contain at least 'root_id' column",
                )
            )
            return ImportValidationResult(is_valid=False, issues=issues)

        for row_idx, row in enumerate(n_reader, start=1):
            rid = row.get("root_id", "").strip()
            if not rid:
                issues.append(ValidationIssue(level="error", message="Missing root_id", row=row_idx, field="root_id"))
                continue
            if rid in neuron_ids:
                issues.append(ValidationIssue(level="error", message=f"Duplicate root_id '{rid}'", row=row_idx, field="root_id"))
            neuron_ids.add(rid)

        s_reader = csv.DictReader(io.StringIO(synapses_csv_text))
        conn_cols = {"pre_root_id", "post_root_id", "syn_count"}
        if not s_reader.fieldnames or not conn_cols.issubset(set(s_reader.fieldnames)):
            issues.append(
                ValidationIssue(
                    level="error",
                    message="Synapse CSV must contain 'pre_root_id', 'post_root_id', 'syn_count'",
                )
            )
            return ImportValidationResult(is_valid=False, issues=issues, neuron_count=len(neuron_ids))

        connection_count = 0
        for row_idx, row in enumerate(s_reader, start=1):
            pre = row.get("pre_root_id", "").strip()
            post = row.get("post_root_id", "").strip()
            count_str = row.get("syn_count", "").strip()

            if pre not in neuron_ids:
                issues.append(ValidationIssue(level="error", message=f"Pre root_id '{pre}' not in neuron set", row=row_idx))
            if post not in neuron_ids:
                issues.append(ValidationIssue(level="error", message=f"Post root_id '{post}' not in neuron set", row=row_idx))

            try:
                cnt = int(count_str)
                if cnt <= 0:
                    issues.append(ValidationIssue(level="error", message="syn_count must be > 0", row=row_idx))
            except ValueError:
                issues.append(ValidationIssue(level="error", message=f"Invalid syn_count '{count_str}'", row=row_idx))

            connection_count += 1

        is_valid = not any(i.level == "error" for i in issues)
        return ImportValidationResult(
            is_valid=is_valid,
            issues=issues,
            neuron_count=len(neuron_ids),
            connection_count=connection_count,
            metadata={"dataset_id": dataset_id, "source": "FlyWire"},
        )

    def parse_to_definition(
        self,
        neurons_csv_text: str,
        synapses_csv_text: str,
        metadata: NetworkMetadataSchema,
        synapse_to_weight_scale: float = 1.5,
    ) -> NetworkDefinitionSchema:
        val = self.validate(neurons_csv_text, synapses_csv_text, metadata.id)
        if not val.is_valid:
            error_msgs = "; ".join(i.message for i in val.issues if i.level == "error")
            raise ValueError(f"FlyWire import validation failed: {error_msgs}")

        neurons: List[NeuronSchema] = []
        classes_map: Dict[str, NeuronClassSchema] = {}

        n_reader = csv.DictReader(io.StringIO(neurons_csv_text))
        for row in n_reader:
            rid = row["root_id"].strip()
            label = row.get("cell_type", "").strip() or row.get("super_class", "").strip() or f"FW-{rid[-6:]}"
            neuropil = row.get("neuropil", "UNC").strip().upper() or "UNC"
            hemisphere = row.get("hemisphere", "L").strip().upper()
            if hemisphere not in ("L", "R"):
                hemisphere = "L"

            # Parse coordinates (optionally normalize from nanometers to visualization units)
            raw_x = float(row.get("x", 0.0))
            raw_y = float(row.get("y", 0.0))
            raw_z = float(row.get("z", 0.0))
            # If coordinates are in nanometers (typical FlyWire ranges 100k-500k nm), scale to [-5, 5]
            scale = 1.0 / 50000.0 if (abs(raw_x) > 1000 or abs(raw_y) > 1000) else 1.0
            pos = [round(raw_x * scale, 3), round(raw_y * scale, 3), round(raw_z * scale, 3)]

            nt_type = row.get("neurotransmitter", "acetylcholine").strip().lower()
            conn_type = "inhibitory" if nt_type in ("gaba", "glutamate_inh") else "excitatory"

            if neuropil not in classes_map:
                classes_map[neuropil] = NeuronClassSchema(
                    id=neuropil,
                    label=f"{neuropil} neuropil",
                    description=f"FlyWire neurons located in {neuropil}",
                    transmitter=conn_type,
                    color=FLYWIRE_PALETTE.get(neuropil, "#4a90e2"),
                )

            neurons.append(
                NeuronSchema(
                    id=rid,
                    label=label,
                    class_id=neuropil,
                    hemisphere=hemisphere,  # type: ignore
                    position=pos,
                    params=LIFParamsSchema(),
                    background_rate_hz=250.0,
                    metadata={
                        "flywire_root_id": rid,
                        "cell_type": row.get("cell_type"),
                        "super_class": row.get("super_class"),
                        "hemilineage": row.get("hemilineage"),
                    },
                )
            )

        connections: List[ConnectionSchema] = []
        s_reader = csv.DictReader(io.StringIO(synapses_csv_text))
        for row in s_reader:
            pre = row["pre_root_id"].strip()
            post = row["post_root_id"].strip()
            syn_cnt = int(row["syn_count"])
            # Illustrative translation from synapse count to drive increment
            weight = round(float(math.sqrt(syn_cnt) * synapse_to_weight_scale), 2)
            c_type = "excitatory"
            # match pre neuron's transmitter
            pre_n = next((n for n in neurons if n.id == pre), None)
            if pre_n and pre_n.class_id in classes_map:
                c_type = classes_map[pre_n.class_id].transmitter

            connections.append(
                ConnectionSchema(
                    source_id=pre,
                    target_id=post,
                    weight=weight,
                    connection_type=c_type,  # type: ignore
                    synapse_count=syn_cnt,
                    metadata={"source": "FlyWire connectome synapse count"},
                )
            )

        populations = [
            PopulationSchema(
                id=f"pop-{cls_id.lower()}",
                label=f"{cls_id} Population",
                role="internal",
                description=f"Neurons in {cls_id}",
                neuron_ids=[n.id for n in neurons if n.class_id == cls_id],
            )
            for cls_id in classes_map
        ]

        metadata.is_synthetic = False
        metadata.source = "connectome-subset"

        return NetworkDefinitionSchema(
            metadata=metadata,
            classes=list(classes_map.values()),
            neurons=neurons,
            connections=connections,
            populations=populations,
            synapse=SynapseParamsSchema(),
        )
