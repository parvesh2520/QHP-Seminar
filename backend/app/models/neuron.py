from sqlalchemy import Column, Float, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


class NeuronModel(Base):
    __tablename__ = "neurons"

    id = Column(String(64), primary_key=True, index=True)
    network_id = Column(String(64), ForeignKey("networks.id", ondelete="CASCADE"), primary_key=True, index=True)
    label = Column(String(128), nullable=False, index=True)
    class_id = Column(String(64), nullable=False, index=True)
    hemisphere = Column(String(8), nullable=False, default="L")

    # 3D coordinates
    x = Column(Float, nullable=False, default=0.0)
    y = Column(Float, nullable=False, default=0.0)
    z = Column(Float, nullable=False, default=0.0)

    # LIF parameters & tonic rate
    params_json = Column(Text, nullable=False)
    background_rate_hz = Column(Float, nullable=False, default=250.0)
    metadata_json = Column(Text, nullable=False, default="{}")

    # Relationships
    network = relationship("NetworkModel", back_populates="neurons")
