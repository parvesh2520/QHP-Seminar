import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.repository import ExperimentRepository, NetworkRepository
from app.models.experiment import ExperimentModel
from app.schemas.experiment import (
    ExperimentConfigSchema,
    ExperimentCreateSchema,
    ExperimentDetailSchema,
    ExperimentRecordSchema,
)
from app.schemas.simulation import ComparisonSummarySchema, SimulationResultSchema
from app.services.simulation_service import SimulationService


class ExperimentService:
    @staticmethod
    def _get_results_dir() -> Path:
        p = settings.DATA_DIR / "experiment_results"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @staticmethod
    def create_experiment(db: Session, config: ExperimentCreateSchema) -> ExperimentRecordSchema:
        # Generate stable experiment ID
        count = db.query(ExperimentModel).count()
        exp_id = f"EXP-{count + 1:03d}"

        # Verify network exists
        net = NetworkRepository.get_network(db, config.network_id)
        if not net:
            raise ValueError(f"Network '{config.network_id}' not found")

        now = datetime.now(timezone.utc)
        model = ExperimentModel(
            id=exp_id,
            network_id=config.network_id,
            status="pending",
            created_at=now,
            config_json=json.dumps(config.model_dump(by_alias=True)),
        )
        saved = ExperimentRepository.create_experiment(db, model)

        return ExperimentRecordSchema(
            id=saved.id,
            network_id=saved.network_id,
            status=saved.status,  # type: ignore
            created_at=int(saved.created_at.timestamp() * 1000),
            config=config,
            error=saved.error,
        )

    @staticmethod
    def run_experiment(db: Session, exp_id: str) -> ExperimentDetailSchema:
        exp = ExperimentRepository.get_experiment(db, exp_id)
        if not exp:
            raise ValueError(f"Experiment '{exp_id}' not found")

        config_dict = json.loads(exp.config_json)
        config = ExperimentConfigSchema(**config_dict)

        net_def = NetworkRepository.get_network_definition(db, exp.network_id)
        if not net_def:
            raise ValueError(f"Network '{exp.network_id}' not found")

        exp.status = "running"
        ExperimentRepository.update_experiment(db, exp)

        try:
            baseline_res, intervention_res, summary = SimulationService.run_matched_experiment(config, net_def)

            # Store serialized results to file to keep SQLite database lean
            results_dir = ExperimentService._get_results_dir()
            result_file = results_dir / f"{exp_id}.json"
            full_data = {
                "baseline": baseline_res.model_dump(by_alias=True),
                "intervention": intervention_res.model_dump(by_alias=True),
            }
            with open(result_file, "w", encoding="utf-8") as f:
                json.dump(full_data, f)

            now = datetime.now(timezone.utc)
            exp.status = "completed"
            exp.completed_at = now
            exp.summary_json = json.dumps(summary.model_dump(by_alias=True))
            exp.results_path = str(result_file)
            exp.error = None
            ExperimentRepository.update_experiment(db, exp)

            return ExperimentDetailSchema(
                id=exp.id,
                network_id=exp.network_id,
                status="completed",
                created_at=int(exp.created_at.timestamp() * 1000),
                completed_at=int(exp.completed_at.timestamp() * 1000) if exp.completed_at else None,
                config=config,
                summary=summary,
                baseline=baseline_res,
                intervention=intervention_res,
            )
        except Exception as e:
            exp.status = "failed"
            exp.error = str(e)
            ExperimentRepository.update_experiment(db, exp)
            raise

    @staticmethod
    def get_experiment_detail(db: Session, exp_id: str) -> Optional[ExperimentDetailSchema]:
        exp = ExperimentRepository.get_experiment(db, exp_id)
        if not exp:
            return None

        config = ExperimentConfigSchema(**json.loads(exp.config_json))
        summary = ComparisonSummarySchema(**json.loads(exp.summary_json)) if exp.summary_json else None

        baseline_res = None
        intervention_res = None
        if exp.results_path and Path(exp.results_path).exists():
            try:
                with open(exp.results_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    baseline_res = SimulationResultSchema(**data["baseline"])
                    intervention_res = SimulationResultSchema(**data["intervention"])
            except Exception:
                pass

        return ExperimentDetailSchema(
            id=exp.id,
            network_id=exp.network_id,
            status=exp.status,  # type: ignore
            created_at=int(exp.created_at.timestamp() * 1000),
            completed_at=int(exp.completed_at.timestamp() * 1000) if exp.completed_at else None,
            config=config,
            summary=summary,
            error=exp.error,
            baseline=baseline_res,
            intervention=intervention_res,
        )

    @staticmethod
    def list_experiments(
        db: Session, network_id: Optional[str] = None, page: int = 1, page_size: int = 30
    ) -> Tuple[int, List[ExperimentRecordSchema]]:
        total, items = ExperimentRepository.list_experiments(db, network_id, page, page_size)
        records: List[ExperimentRecordSchema] = []
        for e in items:
            cfg = ExperimentConfigSchema(**json.loads(e.config_json))
            sum_data = ComparisonSummarySchema(**json.loads(e.summary_json)) if e.summary_json else None
            records.append(
                ExperimentRecordSchema(
                    id=e.id,
                    network_id=e.network_id,
                    status=e.status,  # type: ignore
                    created_at=int(e.created_at.timestamp() * 1000),
                    completed_at=int(e.completed_at.timestamp() * 1000) if e.completed_at else None,
                    config=cfg,
                    summary=sum_data,
                    error=e.error,
                )
            )
        return total, records

    @staticmethod
    def delete_experiment(db: Session, exp_id: str) -> bool:
        exp = ExperimentRepository.get_experiment(db, exp_id)
        if not exp:
            return False
        if exp.results_path:
            try:
                p = Path(exp.results_path)
                if p.exists():
                    p.unlink()
            except Exception:
                pass
        return ExperimentRepository.delete_experiment(db, exp_id)
