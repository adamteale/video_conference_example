import logging

from fastapi import Depends, FastAPI, HTTPException

from starlette.websockets import WebSocket
from starlette.middleware.cors import CORSMiddleware

from app.models import models
from app.routers import video_conference

from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    handlers=[
        logging.FileHandler("/tmp/VideoConfLog.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("VideoConfLog")


class VideoConfApp(FastAPI):
    def __init__(self):
        super().__init__()

        self.name = "videoconf"
        self.__websockets: List[WebSocket] = []

    def addWebsocket(self, websocket: WebSocket):
        self.__websockets.append(websocket)

    def removeWebsocket(self, websocket: WebSocket):
        items_to_remove = [x for x in self.__websockets if x == websocket]
        for item in items_to_remove:
            logger.info("removing", item)
            self.__websockets.remove(item)


app = VideoConfApp()

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(video_conference.router)


@app.on_event("shutdown")
async def shutdown_event():

    logger.info("SHUTDOWN")
    logging.shutdown()
