import json

from pydantic import BaseModel
from uuid import UUID


class VideoConference(BaseModel):

    id: UUID

    class Config:
        orm_mode = True
