from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.network import ConnectionSchema
from app.schemas.neuron import NeuronDetailSchema
from app.services.network_service import NetworkService

router = APIRouter(prefix="/networks/{network_id}/neurons", tags=["Neurons & Synaptic Connections"])


class NeuronPaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[NeuronDetailSchema]


class ConnectionPaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ConnectionSchema]


@router.get("", response_model=NeuronPaginatedResponse, summary="Search and list neurons with filtering")
def list_neurons(
    network_id: str,
    query: Optional[str] = Query(None, description="Search term for ID or label"),
    class_id: Optional[str] = Query(None, description="Filter by neuron class ID"),
    population_id: Optional[str] = Query(None, description="Filter by functional population ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db),
) -> NeuronPaginatedResponse:
    """Return a filterable, paginated list of neurons with connection counts."""
    total, items = NetworkService.get_neurons(db, network_id, query, class_id, population_id, page, page_size)
    return NeuronPaginatedResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/{neuron_id}", response_model=NeuronDetailSchema, summary="Get neuron details by ID")
def get_neuron_detail(
    network_id: str,
    neuron_id: str,
    db: Session = Depends(get_db),
) -> NeuronDetailSchema:
    """Return single neuron details, degree counts, biophysical parameters, and population labels."""
    neuron = NetworkService.get_neuron(db, network_id, neuron_id)
    if not neuron:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Neuron '{neuron_id}' not found in network '{network_id}'",
        )
    return neuron


@router.get("/{neuron_id}/connections", response_model=ConnectionPaginatedResponse, summary="Get neuron synaptic connections")
def get_neuron_connections(
    network_id: str,
    neuron_id: str,
    direction: str = Query("both", pattern="^(both|incoming|outgoing)$", description="Synaptic direction"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> ConnectionPaginatedResponse:
    """Return synaptic connections (incoming, outgoing, or both) for a selected neuron."""
    total, items = NetworkService.get_neuron_connections(db, network_id, neuron_id, direction, page, page_size)
    return ConnectionPaginatedResponse(total=total, page=page, page_size=page_size, items=items)
