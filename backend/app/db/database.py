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
    """Create tables and ensure the synthetic demo network is seeded."""
    from app.models.network import NetworkModel

    Base.metadata.create_all(bind=engine)

    # Seed synthetic network if not already present
    db = SessionLocal()
    try:
        from app.data.synthetic_network import generate_synthetic_network
        existing = db.query(NetworkModel).filter(NetworkModel.id == "synthetic-fly-v1").first()
        if not existing:
            synthetic_def = generate_synthetic_network()
            from app.db.repository import NetworkRepository
            NetworkRepository.save_network_definition(db, synthetic_def)
    finally:
        db.close()
