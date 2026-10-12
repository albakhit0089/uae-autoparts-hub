"""AI-assisted search: extract filters from natural language, then query real inventory."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..security import rate_limit
from ..services.llm import extract_with_claude
from ..services.query_parser import parse_query
from .public import search

router = APIRouter(prefix="/ai", tags=["ai"])


class AiSearchIn(BaseModel):
    q: str = Field(min_length=2, max_length=500)


@router.post("/search", dependencies=[Depends(rate_limit("ai", 20))])
def ai_search(body: AiSearchIn, db: Session = Depends(get_db)):
    parsed = extract_with_claude(body.q)
    engine = "claude" if parsed else "rules"
    parsed = parsed or parse_query(body.q)
    result = search(
        db=db, q=" ".join(parsed.keywords) or None, make=parsed.make, model=parsed.model, year=parsed.year, engine=parsed.engine,
        transmission=None, category=parsed.category, partType=parsed.partType, oem=parsed.oem, emirate=parsed.emirate, area=None,
        minPrice=parsed.minPrice, maxPrice=parsed.maxPrice, condition=parsed.condition, warranty=parsed.warranty, sort="relevance",
    )
    result["parsed"] = parsed.__dict__
    result["extractor"] = engine
    if not result["results"]:
        result["suggestion"] = "No matching stock. Submit a part request so matched suppliers can quote."
    return result
