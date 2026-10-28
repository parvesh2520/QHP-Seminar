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


class CsvConnectomeImporter(BaseConnectomeImporter):
    """Importer for general connectome subsets defined via tabular CSV formats."""

    def validate(
        self,
        neurons_csv_text: str,
        connections_csv_text: str,
        network_id: str,
    ) -> ImportValidationResult:
        issues: List[ValidationIssue] = []
        neuron_ids: Set[str] = set()

        # Validate Neurons CSV
        reader = csv.DictReader(io.StringIO(neurons_csv_text))
        required_neuron_cols = {"id", "label"}
        if not reader.fieldnames or not required_neuron_cols.issubset(set(reader.fieldnames)):
            issues.append(
                ValidationIssue(
                    level="error",
                    message=f"Neurons CSV missing required columns: {required_neuron_cols - set(reader.fieldnames or [])}",
                )
            )
            return ImportValidationResult(is_valid=False, issues=issues)

        for row_idx, row in enumerate(reader, start=1):
            nid = row.get("id", "").strip()
            if not nid:
                issues.append(ValidationIssue(level="error", message="Empty neuron ID", row=row_idx, field="id"))
                continue
            if nid in neuron_ids:
                issues.append(ValidationIssue(level="error", message=f"Duplicate neuron ID '{nid}'", row=row_idx, field="id"))
            neuron_ids.add(nid)

        # Validate Connections CSV
        conn_reader = csv.DictReader(io.StringIO(connections_csv_text))
        required_conn_cols = {"source_id", "target_id", "weight"}
        if not conn_reader.fieldnames or not required_conn_cols.issubset(set(conn_reader.fieldnames)):
            issues.append(
                ValidationIssue(
                    level="error",
                    message=f"Connections CSV missing required columns: {required_conn_cols - set(conn_reader.fieldnames or [])}",
                )
            )
            return ImportValidationResult(is_valid=False, issues=issues, neuron_count=len(neuron_ids))

        conn_count = 0
        for row_idx, row in enumerate(conn_reader, start=1):
            src = row.get("source_id", "").strip()
            tgt = row.get("target_id", "").strip()
            w_str = row.get("weight", "").strip()

            if not src or src not in neuron_ids:
                issues.append(ValidationIssue(level="error", message=f"Unknown source neuron ID '{src}'", row=row_idx, field="source_id"))
            if not tgt or tgt not in neuron_ids:
                issues.append(ValidationIssue(level="error", message=f"Unknown target neuron ID '{tgt}'", row=row_idx, field="target_id"))

            try:
                w = float(w_str)
                if w < 0 or not math.isfinite(w):
                    issues.append(ValidationIssue(level="error", message="Weight must be a non-negative finite number", row=row_idx, field="weight"))
            except ValueError:
                issues.append(ValidationIssue(level="error", message=f"Invalid weight '{w_str}'", row=row_idx, field="weight"))

            conn_count += 1

        is_valid = not any(i.level == "error" for i in issues)
        return ImportValidationResult(
            is_valid=is_valid,
            issues=issues,
            neuron_count=len(neuron_ids),
            connection_count=conn_count,
            metadata={"network_id": network_id},
        )

    def parse_to_definition(
        self,
        neurons_csv_text: str,
        connections_csv_text: str,
        metadata: NetworkMetadataSchema,
    ) -> NetworkDefinitionSchema:
        val = self.validate(neurons_csv_text, connections_csv_text, metadata.id)
        if not val.is_valid:
            error_msgs = "; ".join(i.message for i in val.issues if i.level == "error")
            raise ValueError(f"CSV validation failed: {error_msgs}")

        neurons: List[NeuronSchema] = []
        classes_map: Dict[str, NeuronClassSchema] = {}

        n_reader = csv.DictReader(io.StringIO(neurons_csv_text))
        for row in n_reader:
            nid = row["id"].strip()
            label = row.get("label", nid).strip()
            class_id = row.get("class_id", "UNC").strip() or "UNC"
            hemisphere = row.get("hemisphere", "L").strip().upper()
            if hemisphere not in ("L", "R"):
                hemisphere = "L"

            x = float(row.get("x", 0.0))
            y = float(row.get("y", 0.0))
            z = float(row.get("z", 0.0))

            if class_id not in classes_map:
                classes_map[class_id] = NeuronClassSchema(
                    id=class_id,
                    label=class_id,
                    description=f"Imported class {class_id}",
                    transmitter="excitatory",
                    color="#4a90e2",
                )

            neurons.append(
                NeuronSchema(
                    id=nid,
                    label=label,
                    class_id=class_id,
                    hemisphere=hemisphere,  # type: ignore
                    position=[x, y, z],
                    params=LIFParamsSchema(),
                    background_rate_hz=float(row.get("background_rate_hz", 250.0)),
                    metadata={"imported": True},
                )
            )

        connections: List[ConnectionSchema] = []
        c_reader = csv.DictReader(io.StringIO(connections_csv_text))
        for row in c_reader:
            src = row["source_id"].strip()
            tgt = row["target_id"].strip()
            weight = float(row["weight"])
            conn_type = row.get("type", "excitatory").strip().lower()
            if conn_type not in ("excitatory", "inhibitory"):
                conn_type = "excitatory"
            syn_cnt = int(row["synapse_count"]) if "synapse_count" in row and row["synapse_count"].strip() else None

            connections.append(
                ConnectionSchema(
                    source_id=src,
                    target_id=tgt,
                    weight=weight,
                    connection_type=conn_type,  # type: ignore
                    synapse_count=syn_cnt,
                    metadata={},
                )
            )

        populations = [
            PopulationSchema(
                id="pop-all",
                label="All neurons",
                role="internal",
                description="All imported neurons in this dataset",
                neuron_ids=[n.id for n in neurons],
            )
        ]

        return NetworkDefinitionSchema(
            metadata=metadata,
            classes=list(classes_map.values()),
            neurons=neurons,
            connections=connections,
            populations=populations,
            synapse=SynapseParamsSchema(),
        )
