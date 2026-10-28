from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


class ExperimentModel(Base):
    __tablename__ = "experiments"

    id = Column(String(64), primary_key=True, index=True)
    network_id = Column(String(64), ForeignKey("networks.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="pending")  # pending, running, completed, failed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    config_json = Column(Text, nullable=False)
    summary_json = Column(Text, nullable=True)
    results_path = Column(Text, nullable=True)
    error = Column(Text, nullable=True)

    # Relationships
    network = relationship("NetworkModel", back_populates="experiments")
