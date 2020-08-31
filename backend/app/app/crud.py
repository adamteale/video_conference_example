import logging
from sqlalchemy.orm import Session

from app.models import models
from app import schemas

from datetime import datetime

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(message)s",
    handlers=[
        logging.FileHandler("/tmp/VideoConfLog.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("VideoConfLog")


def create_conference(db: Session):
    db_item = models.VideoConference()
    db.add(db_item)
    db.commit()

    return db_item
