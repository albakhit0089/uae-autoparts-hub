"""Operational jobs. Usage:

    python -m app.jobs migrate                 # apply migrations/*.sql (PostgreSQL)
    python -m app.jobs init-sqlite             # local dev without Postgres: create tables from models
    python -m app.jobs seed-reference          # vehicle catalogue + taxonomy (idempotent)
    python -m app.jobs seed-demo               # + FICTIONAL sample suppliers, listings and demo accounts
    python -m app.jobs import-nhtsa --make toyota --years 2015-2024
    python -m app.jobs stale-stock --days 30   # report listings needing supplier re-confirmation

Schedule `seed-reference` and `import-nhtsa` weekly (cron / GitHub Actions / hosting scheduler).
"""
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import text

from .db import SessionLocal, engine
from .models import Base, Part


def migrate() -> list[str]:
    applied: list[str] = []
    with engine.begin() as conn:
        conn.execute(text("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())"))
        done = {r[0] for r in conn.execute(text("select name from schema_migrations"))}
        for f in sorted((Path(__file__).resolve().parents[1] / "migrations").glob("*.sql")):
            if f.name in done:
                continue
            conn.exec_driver_sql(f.read_text(encoding="utf-8"))
            conn.execute(text("insert into schema_migrations(name) values (:n)"), {"n": f.name})
            applied.append(f.name)
    return applied


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate")
    sub.add_parser("init-sqlite")
    sub.add_parser("seed-reference")
    sub.add_parser("seed-demo")
    n = sub.add_parser("import-nhtsa")
    n.add_argument("--make", required=True)
    n.add_argument("--years", default="2015-2024")
    s = sub.add_parser("stale-stock")
    s.add_argument("--days", type=int, default=30)
    args = ap.parse_args()

    if args.cmd == "migrate":
        print("applied:", migrate() or "nothing new")
        return
    if args.cmd == "init-sqlite":
        Base.metadata.create_all(engine)
        print("tables created")
        return
    from . import seed

    with SessionLocal() as db:
        if args.cmd == "seed-reference":
            seed.load_reference(db)
            print("reference data loaded")
        elif args.cmd == "seed-demo":
            print("demo data loaded:", seed.load_demo(db))
        elif args.cmd == "import-nhtsa":
            from .services.nhtsa import import_make

            a, b = (int(x) for x in args.years.split("-"))
            print(json.dumps(import_make(db, args.make, range(a, b + 1))))
        elif args.cmd == "stale-stock":
            cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)
            rows = db.query(Part.supplier_id, Part.id).filter(Part.status != "sold", Part.last_verified < cutoff).all()
            print(json.dumps({"count": len(rows), "bySupplier": {sid: sum(1 for r in rows if r[0] == sid) for sid in {r[0] for r in rows}}}))


if __name__ == "__main__":
    main()
