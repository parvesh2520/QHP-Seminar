import json
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from app.models.network import NetworkModel
from app.models.neuron import NeuronModel
from app.models.connection import ConnectionModel
from app.models.experiment import ExperimentModel
from app.schemas.network import (
    ConnectionSchema,
    DatasetItemSchema,
    NetworkDefinitionSchema,
    NetworkMetadataSchema,
    PopulationSchema,
    SynapseParamsSchema,
)
from app.schemas.neuron import NeuronClassSchema, NeuronDetailSchema, NeuronSchema


class NetworkRepository:
    @staticmethod
    def list_datasets(db: Session) -> List[DatasetItemSchema]:
        rows = db.query(NetworkModel).all()
        results: List[DatasetItemSchema] = []
        for r in rows:
            n_count = db.query(func.count(NeuronModel.id)).filter(NeuronModel.network_id == r.id).scalar() or 0
            c_count = db.query(func.count(ConnectionModel.id)).filter(ConnectionModel.network_id == r.id).scalar() or 0
            results.append(
                DatasetItemSchema(
                    id=r.id,
                    name=r.name,
                    source=r.source,
                    description=r.description,
                    version=r.version,
                    is_synthetic=r.is_synthetic,
                    neuron_count=n_count,
                    connection_count=c_count,
                    created_at=r.created_at.isoformat() if r.created_at else None,
                )
            )
        return results

    @staticmethod
    def get_network(db: Session, network_id: str) -> Optional[NetworkModel]:
        return db.query(NetworkModel).filter(NetworkModel.id == network_id).first()

    @staticmethod
    def save_network_definition(db: Session, net_def: NetworkDefinitionSchema) -> NetworkModel:
        # Check if already exists
        net = db.query(NetworkModel).filter(NetworkModel.id == net_def.metadata.id).first()
        if not net:
            net = NetworkModel(
                id=net_def.metadata.id,
                name=net_def.metadata.name,
                source=net_def.metadata.source,
                description=net_def.metadata.description,
                version=net_def.metadata.version,
                is_synthetic=net_def.metadata.is_synthetic,
                classes_json=json.dumps([c.model_dump(by_alias=True) for c in net_def.classes]),
                populations_json=json.dumps([p.model_dump(by_alias=True) for p in net_def.populations]),
                synapse_json=json.dumps(net_def.synapse.model_dump(by_alias=True)),
            )
            db.add(net)
            db.flush()
        else:
            # Delete old neurons & connections to replace
            db.query(ConnectionModel).filter(ConnectionModel.network_id == net.id).delete()
            db.query(NeuronModel).filter(NeuronModel.network_id == net.id).delete()
            net.name = net_def.metadata.name
            net.source = net_def.metadata.source
            net.description = net_def.metadata.description
            net.version = net_def.metadata.version
            net.is_synthetic = net_def.metadata.is_synthetic
            net.classes_json = json.dumps([c.model_dump(by_alias=True) for c in net_def.classes])
            net.populations_json = json.dumps([p.model_dump(by_alias=True) for p in net_def.populations])
            net.synapse_json = json.dumps(net_def.synapse.model_dump(by_alias=True))
            db.flush()

        # Batch insert neurons
        neuron_objects = [
            NeuronModel(
                id=n.id,
                network_id=net.id,
                label=n.label,
                class_id=n.class_id,
                hemisphere=n.hemisphere,
                x=n.position[0],
                y=n.position[1],
                z=n.position[2],
                params_json=json.dumps(n.params.model_dump(by_alias=True)),
                background_rate_hz=n.background_rate_hz,
                metadata_json=json.dumps(n.metadata),
            )
            for n in net_def.neurons
        ]
        db.bulk_save_objects(neuron_objects)

        # Batch insert connections
        conn_objects = [
            ConnectionModel(
                network_id=net.id,
                source_id=c.source_id,
                target_id=c.target_id,
                weight=c.weight,
                connection_type=c.connection_type,
                synapse_count=c.synapse_count,
                metadata_json=json.dumps(c.metadata) if c.metadata else None,
            )
            for c in net_def.connections
        ]
        db.bulk_save_objects(conn_objects)
        db.commit()
        return net

    @staticmethod
    def get_network_definition(db: Session, network_id: str) -> Optional[NetworkDefinitionSchema]:
        net = db.query(NetworkModel).filter(NetworkModel.id == network_id).first()
        if not net:
            return None

        classes = [NeuronClassSchema(**c) for c in json.loads(net.classes_json)]
        populations = [PopulationSchema(**p) for p in json.loads(net.populations_json)]
        synapse = SynapseParamsSchema(**json.loads(net.synapse_json))
        metadata = NetworkMetadataSchema(
            id=net.id,
            name=net.name,
            source=net.source,
            description=net.description,
            version=net.version,
            is_synthetic=net.is_synthetic,
        )

        neuron_models = db.query(NeuronModel).filter(NeuronModel.network_id == network_id).all()
        neurons = [
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

        conn_models = db.query(ConnectionModel).filter(ConnectionModel.network_id == network_id).all()
        connections = [
            ConnectionSchema(
                source_id=c.source_id,
                target_id=c.target_id,
                weight=c.weight,
                connection_type=c.connection_type,  # type: ignore
                synapse_count=c.synapse_count,
                metadata=json.loads(c.metadata_json) if c.metadata_json else {},
            )
            for c in conn_models
        ]

        return NetworkDefinitionSchema(
            metadata=metadata,
            classes=classes,
            neurons=neurons,
            connections=connections,
            populations=populations,
            synapse=synapse,
        )

    @staticmethod
    def query_neurons(
        db: Session,
        network_id: str,
        query: Optional[str] = None,
        class_id: Optional[str] = None,
        population_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[int, List[NeuronDetailSchema]]:
        net = db.query(NetworkModel).filter(NetworkModel.id == network_id).first()
        if not net:
            return 0, []

        q = db.query(NeuronModel).filter(NeuronModel.network_id == network_id)

        if class_id:
            q = q.filter(NeuronModel.class_id == class_id)

        if population_id:
            pops = [PopulationSchema(**p) for p in json.loads(net.populations_json)]
            target_pop = next((p for p in pops if p.id == population_id), None)
            if target_pop:
                q = q.filter(NeuronModel.id.in_(target_pop.neuron_ids))
            else:
                return 0, []

        if query:
            pattern = f"%{query.strip()}%"
            q = q.filter(or_(NeuronModel.id.ilike(pattern), NeuronModel.label.ilike(pattern)))

        total = q.count()
        neurons = q.offset((page - 1) * page_size).limit(page_size).all()

        # Build population lookup
        pop_list = [PopulationSchema(**p) for p in json.loads(net.populations_json)]
        pop_map: Dict[str, List[str]] = {}
        for p in pop_list:
            for nid in p.neuron_ids:
                pop_map.setdefault(nid, []).append(p.label)

        # Precompute incoming and outgoing counts for these neurons
        neuron_ids = [n.id for n in neurons]
        in_counts = dict(
            db.query(ConnectionModel.target_id, func.count(ConnectionModel.id))
            .filter(ConnectionModel.network_id == network_id, ConnectionModel.target_id.in_(neuron_ids))
            .group_by(ConnectionModel.target_id)
            .all()
        )
        out_counts = dict(
            db.query(ConnectionModel.source_id, func.count(ConnectionModel.id))
            .filter(ConnectionModel.network_id == network_id, ConnectionModel.source_id.in_(neuron_ids))
            .group_by(ConnectionModel.source_id)
            .all()
        )

        items = [
            NeuronDetailSchema(
                id=n.id,
                label=n.label,
                class_id=n.class_id,
                hemisphere=n.hemisphere,  # type: ignore
                position=[n.x, n.y, n.z],
                params=json.loads(n.params_json),
                background_rate_hz=n.background_rate_hz,
                metadata=json.loads(n.metadata_json) if n.metadata_json else {},
                incoming_count=in_counts.get(n.id, 0),
                outgoing_count=out_counts.get(n.id, 0),
                populations=pop_map.get(n.id, []),
            )
            for n in neurons
        ]
        return total, items

    @staticmethod
    def get_neuron_detail(db: Session, network_id: str, neuron_id: str) -> Optional[NeuronDetailSchema]:
        net = db.query(NetworkModel).filter(NetworkModel.id == network_id).first()
        if not net:
            return None
        n = db.query(NeuronModel).filter(NeuronModel.network_id == network_id, NeuronModel.id == neuron_id).first()
        if not n:
            return None

        in_count = db.query(func.count(ConnectionModel.id)).filter(
            ConnectionModel.network_id == network_id, ConnectionModel.target_id == neuron_id
        ).scalar() or 0

        out_count = db.query(func.count(ConnectionModel.id)).filter(
            ConnectionModel.network_id == network_id, ConnectionModel.source_id == neuron_id
        ).scalar() or 0

        pops = [PopulationSchema(**p) for p in json.loads(net.populations_json)]
        neuron_pops = [p.label for p in pops if neuron_id in p.neuron_ids]

        return NeuronDetailSchema(
            id=n.id,
            label=n.label,
            class_id=n.class_id,
            hemisphere=n.hemisphere,  # type: ignore
            position=[n.x, n.y, n.z],
            params=json.loads(n.params_json),
            background_rate_hz=n.background_rate_hz,
            metadata=json.loads(n.metadata_json) if n.metadata_json else {},
            incoming_count=in_count,
            outgoing_count=out_count,
            populations=neuron_pops,
        )

    @staticmethod
    def query_connections(
        db: Session,
        network_id: str,
        neuron_id: str,
        direction: str = "both",
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[int, List[ConnectionSchema]]:
        q = db.query(ConnectionModel).filter(ConnectionModel.network_id == network_id)
        if direction == "incoming":
            q = q.filter(ConnectionModel.target_id == neuron_id)
        elif direction == "outgoing":
            q = q.filter(ConnectionModel.source_id == neuron_id)
        else:
            q = q.filter(or_(ConnectionModel.source_id == neuron_id, ConnectionModel.target_id == neuron_id))

        total = q.count()
        rows = q.order_by(ConnectionModel.weight.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return total, [
            ConnectionSchema(
                source_id=r.source_id,
                target_id=r.target_id,
                weight=r.weight,
                connection_type=r.connection_type,  # type: ignore
                synapse_count=r.synapse_count,
                metadata=json.loads(r.metadata_json) if r.metadata_json else {},
            )
            for r in rows
        ]


class ExperimentRepository:
    @staticmethod
    def create_experiment(db: Session, exp: ExperimentModel) -> ExperimentModel:
        db.add(exp)
        db.commit()
        db.refresh(exp)
        return exp

    @staticmethod
    def get_experiment(db: Session, exp_id: str) -> Optional[ExperimentModel]:
        return db.query(ExperimentModel).filter(ExperimentModel.id == exp_id).first()

    @staticmethod
    def update_experiment(db: Session, exp: ExperimentModel) -> ExperimentModel:
        db.commit()
        db.refresh(exp)
        return exp

    @staticmethod
    def list_experiments(
        db: Session, network_id: Optional[str] = None, page: int = 1, page_size: int = 30
    ) -> Tuple[int, List[ExperimentModel]]:
        q = db.query(ExperimentModel)
        if network_id:
            q = q.filter(ExperimentModel.network_id == network_id)
        total = q.count()
        items = q.order_by(ExperimentModel.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return total, items

    @staticmethod
    def delete_experiment(db: Session, exp_id: str) -> bool:
        exp = db.query(ExperimentModel).filter(ExperimentModel.id == exp_id).first()
        if not exp:
            return False
        db.delete(exp)
        db.commit()
        return True
