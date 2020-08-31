import os
import logging
from redis import StrictRedis

host = os.environ.get("REDIS_HOST")
port = 6379
# password = "C49E3033C055EDDD39D8F475CE44E6277795EBFBFE0D75B605F3B591874717FF"
charset = "utf-8"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    handlers=[
        logging.FileHandler("/tmp/VideoConfLog.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("VideoConfLog")


def get_redis(decode_responses: bool = True):
    try:
        # redis_conn = StrictRedis(
        #     host=host, port=port, password=password, charset=charset, decode_responses=decode_responses)

        # redis_conn = StrictRedis(
        #     password="C49E3033C055EDDD39D8F475CE44E6277795EBFBFE0D75B605F3B591874717FF", charset="utf-8", decode_responses=True)

        redis_conn = StrictRedis(host=host, port=port,
                                 charset=charset, decode_responses=True)

        logger.info("got redis {}".format(redis_conn))
        return redis_conn
    except:
        logger.info("no redis")
