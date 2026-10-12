import os
import tempfile

# Configure before the app is imported. CI provides DATABASE_URL (PostgreSQL with migrations applied);
# locally we fall back to a throwaway SQLite file.
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["WHATSAPP_TOKEN"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.jobs import migrate  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.security import limiter  # noqa: E402
from app.seed import DEMO_PASSWORD, load_demo  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def database():
    if engine.dialect.name == "postgresql":
        migrate()  # exercises the real SQL migrations
    else:
        Base.metadata.create_all(engine)
    with SessionLocal() as db:
        load_demo(db)
    yield


@pytest.fixture(autouse=True)
def reset_rate_limits():
    limiter.hits.clear()


@pytest.fixture
def client():
    return TestClient(app)


def login(client, email: str) -> dict:
    r = client.post("/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
def customer(client):
    return login(client, "customer@demo.ae")


@pytest.fixture
def supplier(client):
    return login(client, "supplier@demo.ae")


@pytest.fixture
def admin(client):
    return login(client, "admin@demo.ae")
