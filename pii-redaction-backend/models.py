from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from database import Base

class RedactionLog(Base):
    __tablename__ = "redaction_logs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    redacted_entities = Column(String)
    output_path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
