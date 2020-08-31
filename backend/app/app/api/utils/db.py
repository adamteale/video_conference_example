from starlette.requests import Request

from app.database import SessionLocal, engine


# def get_db(request: Request):
#     return request.state.db


def get_db():
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()
