from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.experiment import (
    ExperimentCreateSchema,
    ExperimentDetailSchema,
    ExperimentListResponse,
    ExperimentRecordSchema,
)
from app.services.experiment_service import ExperimentService

router = APIRouter(prefix="/experiments", tags=["Simulations & Experiments"])


@router.post("", response_model=ExperimentRecordSchema, status_code=status.HTTP_201_CREATED, summary="Create new simulation experiment")
def create_experiment(
    config: ExperimentCreateSchema,
    run_now: bool = Query(False, description="Whether to execute the simulation immediately"),
    db: Session = Depends(get_db),
) -> ExperimentRecordSchema:
    """Create a new experiment record with validated intervention parameters."""
    try:
        record = ExperimentService.create_experiment(db, config)
        if run_now:
            detail = ExperimentService.run_experiment(db, record.id)
            return detail
        return record
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post("/{experiment_id}/run", response_model=ExperimentDetailSchema, summary="Execute simulation experiment")
def run_experiment(
    experiment_id: str,
    db: Session = Depends(get_db),
) -> ExperimentDetailSchema:
    """Run the matched LIF simulation (baseline and intervention) for this experiment."""
    try:
        return ExperimentService.run_experiment(db, experiment_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Simulation failed: {e}")


@router.get("", response_model=ExperimentListResponse, summary="List experiment history")
def list_experiments(
    network_id: Optional[str] = Query(None, description="Optional network filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
) -> ExperimentListResponse:
    """Return paginated experiment records from persistent database history."""
    total, items = ExperimentService.list_experiments(db, network_id, page, page_size)
    return ExperimentListResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/{experiment_id}", response_model=ExperimentRecordSchema, summary="Get experiment configuration and status")
def get_experiment(
    experiment_id: str,
    db: Session = Depends(get_db),
) -> ExperimentRecordSchema:
    """Retrieve an experiment's configuration, execution state, and summary metrics."""
    detail = ExperimentService.get_experiment_detail(db, experiment_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found",
        )
    return detail


@router.get("/{experiment_id}/results", response_model=ExperimentDetailSchema, summary="Get full calculated experiment results")
def get_experiment_results(
    experiment_id: str,
    db: Session = Depends(get_db),
) -> ExperimentDetailSchema:
    """Retrieve calculated spike rasters, voltage traces, and comparison summaries for frontend charts."""
    detail = ExperimentService.get_experiment_detail(db, experiment_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found",
        )
    if detail.status == "pending" or detail.status == "running":
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail=f"Experiment '{experiment_id}' is currently {detail.status}",
        )
    if detail.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Experiment failed: {detail.error}",
        )
    return detail


@router.delete("/{experiment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete experiment")
def delete_experiment(
    experiment_id: str,
    db: Session = Depends(get_db),
) -> None:
    """Delete an experiment and its serialized simulation result files."""
    deleted = ExperimentService.delete_experiment(db, experiment_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found",
        )
