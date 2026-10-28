from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# SQLite specific connect args
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables and ensure FlyWire real connectome and synthetic network are seeded."""
    from app.models.network import NetworkModel
    from app.db.repository import NetworkRepository

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Seed Real Adult Drosophila FlyWire Connectome
        from app.data.flywire_network import generate_flywire_network
        existing_fw = db.query(NetworkModel).filter(NetworkModel.id == "flywire-drosophila-v783").first()
        if not existing_fw:
            fw_def = generate_flywire_network()
            NetworkRepository.save_network_definition(db, fw_def)

        # 2. Seed synthetic network
        from app.data.synthetic_network import generate_synthetic_network
        existing_synth = db.query(NetworkModel).filter(NetworkModel.id == "synthetic-fly-v1").first()
        if not existing_synth:
            synthetic_def = generate_synthetic_network()
            NetworkRepository.save_network_definition(db, synthetic_def)
    finally:
        db.close()
