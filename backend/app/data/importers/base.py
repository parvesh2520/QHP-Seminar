from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from app.schemas.network import NetworkDefinitionSchema


class ValidationIssue(BaseModel):
    level: str  # "error", "warning"
    message: str
    row: Optional[int] = None
    field: Optional[str] = None


class ImportValidationResult(BaseModel):
    is_valid: bool
    issues: List[ValidationIssue]
    neuron_count: int = 0
    connection_count: int = 0
    metadata: Dict[str, Any] = {}


class BaseConnectomeImporter(ABC):
    """Abstract base class for connectome data importers."""

    @abstractmethod
    def validate(self, **kwargs: Any) -> ImportValidationResult:
        """Validate input files / records without modifying the database."""
        pass

    @abstractmethod
    def parse_to_definition(self, **kwargs: Any) -> NetworkDefinitionSchema:
        """Convert validated input into a complete NetworkDefinitionSchema."""
        pass
