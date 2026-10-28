from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.analysis import (
    CandidateScreeningRequest,
    ScreeningResponseSchema,
)
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analysis", tags=["Candidate Screening & Analysis"])


@router.post("/candidates", response_model=ScreeningResponseSchema, summary="Screen and rank candidate neurons")
def screen_candidate_neurons(
    req: CandidateScreeningRequest,
    db: Session = Depends(get_db),
) -> ScreeningResponseSchema:
    """Evaluate candidate neuron perturbations and rank by absolute change in downstream output population activity.

    Transparency Note:
    This is an exact deterministic baseline screening method comparing perturbation outcomes
    against a matched baseline run. It is not an opaque AI or machine-learning model.
    """
    try:
        return AnalysisService.screen_candidates(db, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Screening failed: {e}")
