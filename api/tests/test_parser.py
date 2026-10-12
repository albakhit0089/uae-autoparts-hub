from types import SimpleNamespace

from app.services.importer import plan_import
from app.services.query_parser import assess_compatibility, normalize, parse_query


def test_canonical_english_query():
    q = parse_query("I need a used gearbox for a 2015 Mercedes C200 in Sharjah under AED 3,000.")
    assert (q.make, q.model, q.variant, q.year, q.partType, q.emirate, q.maxPrice, q.engine) == (
        "mercedes-benz", "c-class", "C200", 2015, "gearbox", "sharjah", 3000, "M274")


def test_arabic_query():
    q = parse_query("أبي قير لكزس LX570 2016 في دبي أقل من 5 الف درهم")
    assert (q.make, q.model, q.year, q.partType, q.emirate, q.maxPrice) == ("lexus", "lx", 2016, "gearbox", "dubai", 5000)


def test_typos_oem_and_shorthand():
    assert parse_query("transmision nissan patrol").partType == "gearbox"
    assert parse_query("mercedez c class headlight").make == "mercedes-benz"
    q = parse_query("SMP-7229-0205 under 3k")
    assert q.oem == "SMP72290205" and q.maxPrice == 3000
    assert normalize("أبوظبي") == normalize("ابوظبي")


def test_compatibility_rules():
    p = SimpleNamespace(oem="SMP1", make="mercedes-benz", model="c-class", year_from=2015, year_to=2018, engine="M274", fitment="verified")
    assert assess_compatibility(p, "mercedes-benz", "c-class", 2016) == "likely"  # never verified from make/model/year alone
    assert assess_compatibility(p, "mercedes-benz", "c-class", 2016, "M274") == "verified"
    assert assess_compatibility(p, "mercedes-benz", "c-class", 2016, "M276") == "confirm"
    assert assess_compatibility(p, oem="smp-1") == "verified"


def test_importer_matches_frontend_rules():
    rows = [
        {"sku": "A1", "part_type": "Gear Box", "make": "mercedes benz", "model": "C200", "year_from": "2015", "year_to": "2018", "price_aed": "2,750", "condition": "Tested"},
        {"make": "Tesla?", "model": "X", "part_type": "flux", "year_from": "1900", "price_aed": "-5"},
        {"part_type": "brake caliper", "make": "Toyota", "model": "Land Cruiser", "year_from": "2016", "price_aed": "400"},
    ]
    plan = plan_import(rows, supplier_id="sX", emirate="sharjah", area="al-sajaa", existing=[])
    assert len(plan.create) == 1
    assert plan.create[0]["make"] == "mercedes-benz" and plan.create[0]["model"] == "c-class" and plan.create[0]["price"] == 2750
    assert [e["row"] for e in plan.errors] == [3, 4]
    assert "safety-critical" in plan.errors[1]["message"]
