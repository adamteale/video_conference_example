import asyncio
import json
import logging
import time
import uuid

from aioice import Candidate
from aiortc.rtcicetransport import (
    RTCIceCandidate,
    candidate_from_aioice,
)

from starlette.websockets import WebSocket, WebSocketState
from app.api.utils.redis import get_redis

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(message)s",
    handlers=[
        logging.FileHandler("/tmp/VideoConfLog.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("VideoConfLog")

redis_conn = get_redis()


class Peer:
    def __init__(self, id, username, confid):
        self.id = id
        self.username = username
        self.confid = confid


class RoomManager():

    def __init__(self):
        super(RoomManager, self).__init__()

        self.__peers = {}
        self.__should_stop = False

    async def add_ws_connection(self, clientid=str, username=str, confid=str):
        logger.info("ROOM: ADD WS CONNECTION {}".format(clientid))
        peer = Peer(clientid, username, confid)
        self.__peers[clientid] = peer
        logger.info(
            "ROOM: ADD WS CONNECTION - RTCPEERS {}".format(self.__peers))
        await self.askPeerToConnectToOtherPeers(clientid)

    async def remove_ws_connection(self, clientid=str):
        logger.info("ROOM: REMOVE WS CONNECTION {}".format(clientid))
        self.__peers.pop(clientid, None)
        logger.info(
            "ROOM: REMOVE WS CONNECTION - RTCPEERS {}".format(self.__peers))

    async def add_candidate_to_pc(self, pc_id, candidate=RTCIceCandidate):
        logger.info("add_candidate_to_pc {}".format(candidate))
        if candidate:
            this_candidate = candidate.get("candidate")
            if this_candidate:
                logger.info("---------- {}".format(candidate["candidate"]))
                candidate_inst = Candidate.from_sdp(candidate["candidate"])

                rTCIceCandidate = candidate_from_aioice(candidate_inst)
                rTCIceCandidate.sdp = candidate["sdpMid"]
                rTCIceCandidate.sdpMLineIndex = candidate["sdpMLineIndex"]

    def remove(self, connectionId: str):
        logger.info("remove {}".format(connectionId))

    async def stop(self):
        self.__should_stop = True
        logger.info("stop")

    async def askPeerToConnectToOtherPeers(self, wsclientid):
        offerMakerPeer = self.__peers[wsclientid]

        peers_to_offer = [(other_client_id, other_peer) for (other_client_id, other_peer) in self.__peers.items(
        ) if other_client_id != wsclientid and offerMakerPeer.confid == other_peer.confid]

        items = []
        for (other_client_id, other_peer) in peers_to_offer:
            item = {}
            item["clientid"] = other_client_id
            item["username"] = other_peer.username
            items.append(item)
        logger.info("PEERS peers_to_offer: {}".format(peers_to_offer))
        peers_to_offer_json = json.dumps(items)
        logger.info("REQUEST PEER {} TO MAKE OFFERS TO OTHER PEERS: {}".format(
            wsclientid, peers_to_offer))
        redis_conn.rpush("requestPeerToMakeOffers_{}".format(
            wsclientid), peers_to_offer_json)

    async def listen_for_new_ws(self):
        logger.info("ROOM MANAGER listening for new WS...")
        while True:
            client = redis_conn.lpop("wsadded")
            if client:
                clientJson = json.loads(client)
                clientid = clientJson["client"]
                username = clientJson["username"]
                confid = clientJson["confid"]
                await self.add_ws_connection(clientid=clientid, username=username, confid=confid)
                logger.info(
                    "ROOM MANAGER - NEW WS RECEIVED DONE: {}".format(client))
            else:
                await asyncio.sleep(0.01)

    async def listen_for_remove_ws(self):
        logger.info("ROOM MANAGER listening for remove WS...")
        while True:
            clientid = redis_conn.lpop("wsremove")
            if clientid:
                await self.remove_ws_connection(clientid=clientid)
                logger.info("ROOM MANAGER - WS REMOVED: {}".format(clientid))
                # notify active ws's
                for peerid, peer in self.__peers.items():
                    key = "rtcremove_{}".format(peerid)
                    redis_conn.rpush(key, clientid)
            else:
                await asyncio.sleep(0.01)

    async def listen_for_new_rtc_candidate(self):
        logger.info("ROOM MANAGER listening for ICE candidates...")
        while True:
            client_with_ice_candidate = redis_conn.lpop("rtccandidate")
            if client_with_ice_candidate:
                try:
                    jsonData = json.loads(client_with_ice_candidate)
                    candidate = jsonData.get("candidate")
                    clientid = jsonData.get("id")
                    # roomId = jsonData.get("room")
                    await self.add_candidate_to_pc(pc_id=clientid, candidate=candidate)
                    logger.info(
                        "ROOM MANAGER listening for ICE candidates DONE")
                except Exception as e:
                    logger.info(
                        "issue with ICE candiiate json loads {}".format(e))
                    await asyncio.sleep(0.01)
            else:
                await asyncio.sleep(0.01)


if __name__ == "__main__":
    logger.info("ROOM MANAGER launch...")
    app = RoomManager()

    futures = asyncio.gather(
        app.listen_for_new_ws(),
        app.listen_for_new_rtc_candidate(),
        app.listen_for_remove_ws())

    loop = asyncio.get_event_loop()
    loop.run_until_complete(futures)
