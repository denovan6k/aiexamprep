from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str


class PlaceholderResponse(BaseModel):
    module: str
    status: str = "planned"
    message: str

