import json
from collections import deque
from typing import List, Optional, Set, Tuple
from sqlalchemy.orm import Session
from app.db.repository import NetworkRepository
from app.models.connection import ConnectionModel
from app.models.neuron import NeuronModel
from app.schemas.network import (
    ConnectionSchema,
    DatasetItemSchema,
    NetworkDefinitionSchema,
    NetworkMetadataSchema,
    NetworkSummarySchema,
    SubgraphRequestSchema,
    SubgraphResponseSchema,
    SynapseParamsSchema,
)
from app.schemas.neuron import NeuronClassSchema, NeuronDetailSchema, NeuronSchema


class NetworkService:
    @staticmethod
    def list_datasets(db: Session) -> List[DatasetItemSchema]:
        return NetworkRepository.list_datasets(db)

    @staticmethod
    def get_network_summary(db: Session, network_id: str) -> Optional[NetworkSummarySchema]:
        net = NetworkRepository.get_network(db, network_id)
        if not net:
            return None

        n_count = db.query(NeuronModel).filter(NeuronModel.network_id == network_id).count()
        c_count = db.query(ConnectionModel).filter(ConnectionModel.network_id == network_id).count()

        classes = [NeuronClassSchema(**c) for c in json.loads(net.classes_json)]
        synapse = SynapseParamsSchema(**json.loads(net.synapse_json))
        pops = json.loads(net.populations_json)

        # Class counts
        class_counts = {}
        for c in classes:
            cnt = db.query(NeuronModel).filter(NeuronModel.network_id == network_id, NeuronModel.class_id == c.id).count()
            class_counts[c.id] = cnt

        pop_counts = {p["id"]: len(p.get("neuron_ids", p.get("neuronIds", []))) for p in pops}

        return NetworkSummarySchema(
            id=net.id,
            metadata=NetworkMetadataSchema(
                id=net.id,
                name=net.name,
                source=net.source,
                description=net.description,
                version=net.version,
                is_synthetic=net.is_synthetic,
            ),
            neuron_count=n_count,
            connection_count=c_count,
            class_counts=class_counts,
            population_counts=pop_counts,
            synapse=synapse,
        )

    @staticmethod
    def get_network_definition(db: Session, network_id: str) -> Optional[NetworkDefinitionSchema]:
        return NetworkRepository.get_network_definition(db, network_id)

    @staticmethod
    def get_neurons(
        db: Session,
        network_id: str,
        query: Optional[str] = None,
        class_id: Optional[str] = None,
        population_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[int, List[NeuronDetailSchema]]:
        return NetworkRepository.query_neurons(db, network_id, query, class_id, population_id, page, page_size)

    @staticmethod
    def get_neuron(db: Session, network_id: str, neuron_id: str) -> Optional[NeuronDetailSchema]:
        return NetworkRepository.get_neuron_detail(db, network_id, neuron_id)

    @staticmethod
    def get_neuron_connections(
        db: Session,
        network_id: str,
        neuron_id: str,
        direction: str = "both",
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[int, List[ConnectionSchema]]:
        return NetworkRepository.query_connections(db, network_id, neuron_id, direction, page, page_size)

    @staticmethod
    def extract_subgraph(db: Session, network_id: str, req: SubgraphRequestSchema) -> SubgraphResponseSchema:
        """BFS graph traversal centered on requested seed neurons up to specified depth."""
        net = NetworkRepository.get_network(db, network_id)
        if not net:
            raise ValueError(f"Network '{network_id}' not found")

        visited_nodes: Set[str] = set(req.neuron_ids)
        queue: deque[Tuple[str, int]] = deque((nid, 0) for nid in req.neuron_ids)
        collected_edges: List[ConnectionModel] = []
        seen_edge_ids: Set[int] = set()

        while queue and len(visited_nodes) < req.limit_nodes:
            curr_id, curr_depth = queue.popleft()
            if curr_depth >= req.depth:
                continue

            # Query adjacent connections
            q = db.query(ConnectionModel).filter(ConnectionModel.network_id == network_id)
            if req.direction == "incoming":
                q = q.filter(ConnectionModel.target_id == curr_id)
            elif req.direction == "outgoing":
                q = q.filter(ConnectionModel.source_id == curr_id)
            else:
                q = q.filter(
                    (ConnectionModel.source_id == curr_id) | (ConnectionModel.target_id == curr_id)
                )

            adjacent_conns = q.all()
            for conn in adjacent_conns:
                if conn.id not in seen_edge_ids:
                    seen_edge_ids.add(conn.id)
                    collected_edges.append(conn)

                nbr = conn.target_id if conn.source_id == curr_id else conn.source_id
                if nbr not in visited_nodes:
                    if len(visited_nodes) < req.limit_nodes:
                        visited_nodes.add(nbr)
                        queue.append((nbr, curr_depth + 1))

        # Check edge limits
        truncated = len(collected_edges) > req.limit_edges or len(visited_nodes) >= req.limit_nodes
        capped_edges = collected_edges[: req.limit_edges]

        # Fetch neuron metadata for all visited nodes
        neuron_models = (
            db.query(NeuronModel)
            .filter(NeuronModel.network_id == network_id, NeuronModel.id.in_(visited_nodes))
            .all()
        )

        nodes = [
            NeuronSchema(
                id=n.id,
                label=n.label,
                class_id=n.class_id,
                hemisphere=n.hemisphere,  # type: ignore
                position=[n.x, n.y, n.z],
                params=json.loads(n.params_json),
                background_rate_hz=n.background_rate_hz,
                metadata=json.loads(n.metadata_json) if n.metadata_json else {},
            )
            for n in neuron_models
        ]

        edges = [
            ConnectionSchema(
                source_id=c.source_id,
                target_id=c.target_id,
                weight=c.weight,
                connection_type=c.connection_type,  # type: ignore
                synapse_count=c.synapse_count,
                metadata=json.loads(c.metadata_json) if c.metadata_json else {},
            )
            for c in capped_edges
        ]

        return SubgraphResponseSchema(
            nodes=nodes,
            edges=edges,
            depth=req.depth,
            truncated=truncated,
            total_nodes_in_neighborhood=len(visited_nodes),
            total_edges_in_neighborhood=len(collected_edges),
        )
