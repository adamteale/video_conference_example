# coding: utf-8
import uuid
import json

from app.database import Base

from enum import IntEnum

from sqlalchemy_utils import UUIDType

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    Float,
    LargeBinary,
    String,
    TIMESTAMP,
    Table,
    DateTime,
    PrimaryKeyConstraint,
    Enum
)

from sqlalchemy.dialects.postgresql import UUID


metadata = Base.metadata


class VideoConference(Base):

    __tablename__ = "videoconference"

    # Pass `binary=False` to fallback to CHAR instead of BINARY
    id = Column("id", UUIDType(binary=False),
                default=uuid.uuid4, primary_key=True)
