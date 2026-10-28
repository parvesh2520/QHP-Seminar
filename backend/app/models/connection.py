from sqlalchemy import Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


class ConnectionModel(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    network_id = Column(String(64), ForeignKey("networks.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id = Column(String(64), nullable=False, index=True)
    target_id = Column(String(64), nullable=False, index=True)
    weight = Column(Float, nullable=False)
    connection_type = Column(String(32), nullable=False, default="excitatory")
    synapse_count = Column(Integer, nullable=True)
    metadata_json = Column(Text, nullable=True)

    # Relationships
    network = relationship("NetworkModel", back_populates="connections")
