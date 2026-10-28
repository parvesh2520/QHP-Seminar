from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.network import (
    NetworkDefinitionSchema,
    NetworkSummarySchema,
    SubgraphRequestSchema,
    SubgraphResponseSchema,
)
from app.services.network_service import NetworkService

router = APIRouter(prefix="/networks", tags=["Network & Subgraph Topology"])


@router.get("/{network_id}/summary", response_model=NetworkSummarySchema, summary="Network summary and statistics")
def get_network_summary(network_id: str, db: Session = Depends(get_db)) -> NetworkSummarySchema:
    """Return neuron count, connection count, and dataset provenance for a network."""
    summary = NetworkService.get_network_summary(db, network_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Network with id '{network_id}' not found",
        )
    return summary


@router.get("/{network_id}/definition", response_model=NetworkDefinitionSchema, summary="Full network definition")
def get_network_definition(network_id: str, db: Session = Depends(get_db)) -> NetworkDefinitionSchema:
    """Return the complete network definition (neurons, classes, connections, populations)."""
    net_def = NetworkService.get_network_definition(db, network_id)
    if not net_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Network with id '{network_id}' not found",
        )
    return net_def


@router.get("/{network_id}/subgraph", response_model=SubgraphResponseSchema, summary="Get neighborhood subgraph for 3D viewer")
def get_network_subgraph(
    network_id: str,
    neuron_ids: List[str] = Query(..., description="Root seed neuron IDs to expand around"),
    depth: int = Query(1, ge=1, le=4, description="Neighborhood depth"),
    limit_nodes: int = Query(150, ge=1, le=500, description="Node limit"),
    limit_edges: int = Query(600, ge=1, le=2000, description="Edge limit"),
    direction: str = Query("both", pattern="^(both|incoming|outgoing)$"),
    db: Session = Depends(get_db),
) -> SubgraphResponseSchema:
    """Extract a local neighborhood subgraph around target seed neurons for interactive 3D rendering."""
    req = SubgraphRequestSchema(
        neuron_ids=neuron_ids,
        depth=depth,
        limit_nodes=limit_nodes,
        limit_edges=limit_edges,
        direction=direction,  # type: ignore
    )
    try:
        return NetworkService.extract_subgraph(db, network_id, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{network_id}/subgraph", response_model=SubgraphResponseSchema, summary="Post query for neighborhood subgraph")
def post_network_subgraph(
    network_id: str,
    req: SubgraphRequestSchema,
    db: Session = Depends(get_db),
) -> SubgraphResponseSchema:
    """POST endpoint for neighborhood subgraph extraction."""
    try:
        return NetworkService.extract_subgraph(db, network_id, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
