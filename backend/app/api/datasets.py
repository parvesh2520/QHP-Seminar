from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.data.importers.csv_importer import CsvConnectomeImporter
from app.data.importers.flywire_importer import FlyWireConnectomeImporter
from app.db.database import get_db
from app.db.repository import NetworkRepository
from app.schemas.network import DatasetItemSchema, NetworkMetadataSchema
from app.services.network_service import NetworkService

router = APIRouter(prefix="/datasets", tags=["Datasets & Provenance"])


class ImportCsvRequest(BaseModel):
    id: str = Field(..., description="Unique dataset identifier")
    name: str = Field(..., description="Dataset display name")
    description: str = Field("", description="Dataset notes and documentation")
    version: str = Field("1.0.0")
    neurons_csv: str = Field(..., description="Raw CSV string containing neuron records")
    connections_csv: str = Field(..., description="Raw CSV string containing connection records")


class ImportFlyWireRequest(BaseModel):
    id: str = Field(..., description="Unique dataset identifier")
    name: str = Field(..., description="Dataset display name")
    description: str = Field("", description="FlyWire connectome subset description")
    version: str = Field("783")
    neurons_csv: str = Field(..., description="FlyWire neurons CSV with root_id, cell_type, neuropil, etc.")
    synapses_csv: str = Field(..., description="FlyWire synapses CSV with pre_root_id, post_root_id, syn_count")


@router.get("", response_model=List[DatasetItemSchema], summary="List all available connectome datasets")
def list_datasets(db: Session = Depends(get_db)) -> List[DatasetItemSchema]:
    """Return all available datasets with full provenance metadata (synthetic vs connectome-subset)."""
    return NetworkService.list_datasets(db)


@router.post("/import", response_model=DatasetItemSchema, status_code=status.HTTP_201_CREATED, summary="Import standard connectome CSV")
def import_csv_dataset(req: ImportCsvRequest, db: Session = Depends(get_db)) -> DatasetItemSchema:
    """Validate and import a connectome subset from CSV tables."""
    importer = CsvConnectomeImporter()
    metadata = NetworkMetadataSchema(
        id=req.id,
        name=req.name,
        source="connectome-subset",
        description=req.description,
        version=req.version,
        is_synthetic=False,
    )
    try:
        net_def = importer.parse_to_definition(req.neurons_csv, req.connections_csv, metadata)
        NetworkRepository.save_network_definition(db, net_def)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    summary = NetworkService.get_network_summary(db, req.id)
    if not summary:
        raise HTTPException(status_code=500, detail="Failed to retrieve imported dataset")

    return DatasetItemSchema(
        id=summary.id,
        name=summary.metadata.name,
        source=summary.metadata.source,
        description=summary.metadata.description,
        version=summary.metadata.version,
        is_synthetic=summary.metadata.is_synthetic,
        neuron_count=summary.neuron_count,
        connection_count=summary.connection_count,
    )


@router.post("/import-flywire", response_model=DatasetItemSchema, status_code=status.HTTP_201_CREATED, summary="Import FlyWire connectome subset")
def import_flywire_dataset(req: ImportFlyWireRequest, db: Session = Depends(get_db)) -> DatasetItemSchema:
    """Validate and import an authentic FlyWire connectome subset."""
    importer = FlyWireConnectomeImporter()
    metadata = NetworkMetadataSchema(
        id=req.id,
        name=req.name,
        source="connectome-subset",
        description=req.description or "FlyWire fruit-fly connectome subset",
        version=req.version,
        is_synthetic=False,
    )
    try:
        net_def = importer.parse_to_definition(req.neurons_csv, req.synapses_csv, metadata)
        NetworkRepository.save_network_definition(db, net_def)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    summary = NetworkService.get_network_summary(db, req.id)
    if not summary:
        raise HTTPException(status_code=500, detail="Failed to retrieve imported dataset")

    return DatasetItemSchema(
        id=summary.id,
        name=summary.metadata.name,
        source=summary.metadata.source,
        description=summary.metadata.description,
        version=summary.metadata.version,
        is_synthetic=summary.metadata.is_synthetic,
        neuron_count=summary.neuron_count,
        connection_count=summary.connection_count,
    )
