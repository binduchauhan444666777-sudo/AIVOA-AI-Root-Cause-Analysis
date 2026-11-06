from pydantic import BaseModel, Field
from typing import Any

class IncidentData(BaseModel):
    title: str = "Untitled investigation"
    batch_number: str = ""
    product_name: str = ""
    incident_date: str = ""
    department: str = ""
    severity: str = "Medium"
    status: str = "Draft"
    incident_description: str = ""
    containment_action: str = ""
    investigation_method: str = "5 Whys"

class AnalyzeRequest(BaseModel):
    incident: IncidentData
    method: str = "5 Whys"

class SaveRequest(BaseModel):
    incident: IncidentData
    analysis: dict[str, Any] = Field(default_factory=dict)
