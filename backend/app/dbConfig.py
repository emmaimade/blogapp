import os
from dotenv import load_dotenv
from sqlmodel import create_engine, SQLModel, Session
from pathlib import Path

# load environment variables from .env file
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

db_url = os.getenv("DATABASE_URL")

engine = create_engine(db_url, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
