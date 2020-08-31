import asyncio
import json
import logging

from app import crud, models, schemas
from app.api.utils.db import get_db
from app.api.utils.redis import get_redis

from fastapi import APIRouter
from fastapi import Depends, FastAPI, HTTPException

from pydantic import BaseModel

from sqlalchemy.orm import Session

from starlette.requests import HTTPConnection, Request
from starlette.responses import HTMLResponse
from starlette.responses import StreamingResponse
from starlette.websockets import WebSocket, WebSocketState

from typing import List, Optional

redis_conn = get_redis()

router = APIRouter()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    handlers=[
        logging.FileHandler("/tmp/VideoConfLog.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("VideoConfLog")


@router.websocket("/wsroom")
async def wsroom(ws: WebSocket):

    await ws.accept()

    app = ws.app
    client = {"client": "", "username": "", "confid": ""}

    logger.info("SERVER - NEW WS CONNECTION - APP {}".format(app.name))
    logger.info("SERVER - NEW WS CONNECTION - APP {}".format(app.name))

    async def sendAnswer():

        key = "rtcanswer_{}".format(client["client"])
        logger.info("SERVER - SEND ANSWER TO PEER {}".format(key))
        while ws.client_state == WebSocketState.CONNECTED:
            data = redis_conn.lpop(key)
            if data:
                logger.info("SERVER - SEND ANSWER TO PEER ANSWER RECVD")
                jsonData = json.loads(data)
                logger.info(
                    "SERVER - SEND ANSWER TO PEER ANSWER RECVD answer: {}".format(jsonData.get("answer")))
                logger.info(
                    "SERVER - SEND ANSWER TO PEER ANSWER RECVD otherPeerid: {}".format(jsonData.get("otherPeerid")))
                logger.info(
                    "SERVER - SEND ANSWER TO PEER ANSWER RECVD id: {}".format(jsonData.get("id")))
                answerMsg = {
                    "msgtype": "RTCANSWER",
                    "answer": jsonData.get("answer"),
                    "otherPeerid": jsonData.get("otherPeerid"),
                    "id": jsonData.get("id")
                }
                logger.info("sendAnswer {} {}".format(
                    client["client"], answerMsg))
                await ws.send_json(answerMsg)
            else:
                await asyncio.sleep(0.1)

    async def sendOffer():
        key = "rtcoffer_{}".format(client["client"])
        logger.info("SERVER - SEND OFFER TO PEER OFFER {}".format(key))
        while ws.client_state == WebSocketState.CONNECTED:

            offer = redis_conn.lpop(key)
            if offer:
                logger.info("SERVER - SEND OFFER TO PEER OFFER RECVD")
                offerJson = json.loads(offer)
                offerMsg = {
                    "msgtype": "RTCOFFER",
                    "offer": offerJson
                }
                # logger.info("sendOffer {} {}".format(client["client"], offerMsg))
                await ws.send_json(offerMsg)
            else:
                await asyncio.sleep(0.1)

    async def requestPeerToMakeOffers():
        key = "requestPeerToMakeOffers_{}".format(client["client"])

        while ws.client_state == WebSocketState.CONNECTED:

            peers = redis_conn.lpop(key)
            if peers:
                peersJson = json.loads(peers)
                offerMsg = {
                    "msgtype": "RTCCREATEOFFERFORPEERS",
                    "peers": peersJson
                }
                logger.info(
                    "SERVER - SEND REQUEST TO PEER {} TO MAKE OFFERS {}".format(client["client"], offerMsg))
                await ws.send_json(offerMsg)
            else:
                await asyncio.sleep(0.1)

    async def sendRemovePeer():
        key = "rtcremove_{}".format(client["client"])
        logger.info("SERVER - SEND REMOVE PEER {}".format(key))
        while ws.client_state == WebSocketState.CONNECTED:

            clientToRemove = redis_conn.lpop(key)
            if clientToRemove:
                logger.info(
                    "SERVER - SEND REMOVE PEER: {} FROM CLIENT: {}".format(clientToRemove, client["client"]))
                remove_dict = {"msgtype": "REMOVEPEER",
                               "remove": [clientToRemove]}
                # logger.info("sendOffer {} {}".format(client["client"], offerMsg))
                logger.info("SERVER - SEND REMOVE PEER: WILL SEND")
                await ws.send_json(remove_dict)
                logger.info("SERVER - SEND REMOVE PEER: SENT")
            else:
                await asyncio.sleep(0.1)

    async def onMessage(data):

        logger.info(
            "SERVER - RTCPEERCONNECTION ANSWER FOR ID: {}".format(data))
        ws_type = data.get("msgtype", None)
        if ws_type == "WSOPEN":
            client["client"] = data.get("clientid")
            client["username"] = data.get("username")
            client["confid"] = data.get("confid")

            await ws.send_json({"msgtype": "HOLA", "appid": app.name})

            # logger.info("SERVER - NEW WS CONNECTION {}".format(client["client"]))
            app.addWebsocket(ws)
            asyncio.ensure_future(sendOffer())
            asyncio.ensure_future(sendRemovePeer())
            asyncio.ensure_future(sendAnswer())
            asyncio.ensure_future(requestPeerToMakeOffers())

            redis_conn.rpush("wsadded", json.dumps(client))

        elif ws_type == "RTCANSWER":
            logger.info(
                "SERVER - RTCPEERCONNECTION ANSWER FOR ID: {}".format(data.get("id")))
            logger.info(
                "SERVER - RTCPEERCONNECTION ANSWER FOR ID answer: {}".format(data.get("answer")))
            logger.info(
                "SERVER - RTCPEERCONNECTION ANSWER FOR ID confid: {}".format(data.get("confid")))
            redis_conn.rpush("rtcanswer_{}".format(
                data.get("id")), json.dumps(data))

        elif ws_type == "RTCOFFER":
            logger.info(
                "SERVER - RTCPEERCONNECTION OFFER FROM PEER: {}".format(data.get("id")))
            redis_conn.rpush("rtcoffer", json.dumps(data))

        elif ws_type == "RTCOFFERFORPEER":
            logger.info(
                "SERVER - RTCPEERCONNECTION OFFER FROM PEER: {}".format(data.get("id")))
            if data.get("otherPeerid"):
                logger.info(
                    "SERVER - RTCPEERCONNECTION OTHER PEER ID: {}".format(data))
                key = "rtcoffer_{}".format(data.get("otherPeerid"))
                redis_conn.rpush(key, json.dumps(data))

        elif ws_type == "RTCCANDIDATE":
            logger.info(
                "SERVER - CANDIDATE RECEIVED: {}".format(data.get("id")))
            redis_conn.rpush("rtccandidate", json.dumps(data))

    async def onClose(data):
        logger.info("SERVER - RTCPEERCONNECTION CLOSED ID: {}".format(data))

    while True:
        try:
            data = await ws.receive_json()
            await onMessage(data)
        except Exception as e:
            logger.info("disconnection from {} {}".format(e, ws))
            app.removeWebsocket(ws)
            redis_conn.rpush("wsremove", client["client"])
            return False
    close = await ws.close()
    await onClose(close)


@router.get(
    "/conf",
    tags=["videoconference"],
    response_model=schemas.VideoConference,
)
def create_conference(
    db: Session = Depends(get_db),
):

    logger.info("create conference")

    conference = crud.create_conference(
        db=db
    )

    logger.info("conference {}".format(conference))

    if conference is None:
        raise HTTPException(status_code=404, detail="Contact an admin user")
    return conference
