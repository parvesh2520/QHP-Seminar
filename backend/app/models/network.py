from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


class NetworkModel(Base):
    __tablename__ = "networks"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    source = Column(String(64), nullable=False, default="synthetic")
    description = Column(Text, nullable=False, default="")
    version = Column(String(32), nullable=False, default="1.0.0")
    is_synthetic = Column(Boolean, nullable=False, default=True)

    # Serialized structures: classes, populations, synapse
    classes_json = Column(Text, nullable=False)
    populations_json = Column(Text, nullable=False)
    synapse_json = Column(Text, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    neurons = relationship("NeuronModel", back_populates="network", cascade="all, delete-orphan")
    connections = relationship("ConnectionModel", back_populates="network", cascade="all, delete-orphan")
    experiments = relationship("ExperimentModel", back_populates="network", cascade="all, delete-orphan")
