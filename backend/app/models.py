from datetime import datetime
from sqlalchemy import String, Text, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class Investigation(Base):
    __tablename__ = "investigations"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(220), default="Untitled investigation")
    batch_number: Mapped[str] = mapped_column(String(120), default="")
    product_name: Mapped[str] = mapped_column(String(180), default="")
    incident_date: Mapped[str] = mapped_column(String(40), default="")
    department: Mapped[str] = mapped_column(String(120), default="")
    severity: Mapped[str] = mapped_column(String(40), default="Medium")
    status: Mapped[str] = mapped_column(String(50), default="Draft")
    incident_description: Mapped[str] = mapped_column(Text, default="")
    containment_action: Mapped[str] = mapped_column(Text, default="")
    investigation_method: Mapped[str] = mapped_column(String(40), default="5 Whys")
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
