from fastapi import APIRouter
from app.api.health import router as health_router
from app.api.datasets import router as datasets_router
from app.api.network import router as network_router
from app.api.neurons import router as neurons_router
from app.api.experiments import router as experiments_router
from app.api.analysis import router as analysis_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(datasets_router)
api_router.include_router(network_router)
api_router.include_router(neurons_router)
api_router.include_router(experiments_router)
api_router.include_router(analysis_router)

__all__ = ["api_router"]
