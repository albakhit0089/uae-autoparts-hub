"""End-to-end API workflows for customers, suppliers and administrators."""
import uuid

from .conftest import login


def test_health_and_openapi(client):
    assert client.get("/health").json() == {"ok": True}
    assert "/parts/search" in client.get("/openapi.json").json()["paths"]


# ----------------------------------------------------------------- auth

def test_login_and_me(client, customer):
    me = client.get("/auth/me", headers=customer).json()
    assert me["email"] == "customer@demo.ae" and me["role"] == "customer" and me["passwordHash"] == ""
    assert client.post("/auth/login", json={"email": "customer@demo.ae", "password": "wrong"}).status_code == 401
    assert client.get("/auth/me").status_code == 401


def test_register_customer_rejects_duplicates(client):
    email = f"c-{uuid.uuid4().hex[:6]}@uaeph-test.ae"
    body = {"name": "Test User", "email": email, "password": "longpassword"}
    assert client.post("/auth/register", json=body).status_code == 200
    assert client.post("/auth/register", json=body).status_code == 409
    assert client.post("/auth/register", json={**body, "email": "x" + email, "password": "short"}).status_code == 422


def test_login_rate_limited(client):
    codes = [client.post("/auth/login", json={"email": "nobody@uaeph-test.ae", "password": "x"}).status_code for _ in range(12)]
    assert 429 in codes


# --------------------------------------------------------------- search

def test_natural_language_search_returns_only_matching_inventory(client):
    r = client.get("/parts/search", params={"q": "gearbox 2015 Mercedes C200 Sharjah under AED 3,000"}).json()
    assert r["applied"]["maxPrice"] == 3000 and r["parsed"]["partType"] == "gearbox"
    assert r["results"], "sample data contains a matching gearbox"
    for row in r["results"]:
        p = row["part"]
        assert p["make"] == "mercedes-benz" and p["partTypeId"] == "gearbox" and p["emirate"] == "sharjah"
        assert p["price"] <= 3000 and p["yearFrom"] <= 2015 <= p["yearTo"]
        assert row["compatibility"] in ("verified", "likely", "confirm")
        assert p["supplierId"] in r["suppliers"]


def test_search_nonsense_returns_nothing(client):
    assert client.get("/parts/search", params={"q": "zzqx flux capacitor"}).json()["results"] == []


def test_public_endpoints_hide_private_supplier_fields(client):
    sups = client.get("/suppliers").json()
    assert sups and all(s["tradeLicence"] == "" and s["docs"] == [] and s["status"] == "approved" for s in sups)
    assert all(s["id"] != "s12" for s in sups)  # pending supplier is not public


def test_compare_groups_by_identical_oem(client):
    part = next(row["part"] for row in client.get("/parts/search").json()["results"] if row["part"]["oem"])
    rows = client.get(f"/parts/{part['id']}/compare").json()["rows"]
    assert rows and all(r["part"]["oem"] == part["oem"] and r["basis"] == "oem" for r in rows)


def test_inquiry_is_logged_and_returns_whatsapp_link(client, supplier):
    pid = client.get("/parts/search", params={"make": "mercedes-benz"}).json()["results"][0]["part"]["id"]
    before = len(client.get("/supplier/inquiries", headers=supplier).json())
    r = client.post("/inquiries", json={"partId": pid, "lang": "en"}).json()
    assert r["url"].startswith("https://wa.me/") and "UAE%20AutoParts%20Hub" in r["url"]
    owner = client.get(f"/parts/{pid}").json()["supplier"]["id"]
    if owner == "s1":
        assert len(client.get("/supplier/inquiries", headers=supplier).json()) == before + 1


# ------------------------------------------------------- supplier workflow

PART = {"partTypeId": "alternator", "make": "toyota", "model": "camry", "yearFrom": 2018, "yearTo": 2020, "engine": "A25A-FKS",
        "condition": "tested", "price": 450, "quantity": 2, "warrantyDays": 14, "description": "Test listing"}


def test_supplier_listing_lifecycle(client, supplier):
    p = client.post("/supplier/parts", json=PART, headers=supplier).json()
    assert p["moderation"] == "approved" and p["emirate"] == "sharjah"
    assert any(x["id"] == p["id"] for x in client.get("/supplier/parts", headers=supplier).json())
    found = client.get("/parts/search", params={"make": "toyota", "model": "camry", "partType": "alternator"}).json()["results"]
    assert any(r["part"]["id"] == p["id"] for r in found)

    upd = client.put(f"/supplier/parts/{p['id']}", json={**PART, "price": 400}, headers=supplier).json()
    assert upd["price"] == 400
    assert client.post(f"/supplier/parts/{p['id']}/status", json={"status": "sold"}, headers=supplier).status_code == 200
    found = client.get("/parts/search", params={"make": "toyota", "model": "camry", "partType": "alternator"}).json()["results"]
    assert all(r["part"]["id"] != p["id"] for r in found)


def test_safety_critical_parts_need_oem_and_review(client, supplier):
    body = {**PART, "partTypeId": "brake-caliper"}
    assert client.post("/supplier/parts", json=body, headers=supplier).status_code == 422
    p = client.post("/supplier/parts", json={**body, "oem": "47730-60"}, headers=supplier).json()
    assert p["moderation"] == "pending" and p["oem"] == "4773060"


def test_supplier_cannot_touch_other_suppliers_parts(client, supplier):
    other = client.get("/suppliers/s2").json()["parts"][0]["id"]
    assert client.put(f"/supplier/parts/{other}", json=PART, headers=supplier).status_code == 404
    assert client.delete(f"/supplier/parts/{other}", headers=supplier).status_code == 404


def test_role_enforcement(client, customer, supplier):
    assert client.get("/admin/overview", headers=customer).status_code == 403
    assert client.get("/admin/overview", headers=supplier).status_code == 403
    assert client.get("/supplier/parts", headers=customer).status_code == 403


def test_bulk_import_report(client, supplier):
    sku = f"T-{uuid.uuid4().hex[:6]}"
    rows = [
        {"sku": sku, "part_type": "radiator", "make": "Lexus", "model": "ES350", "year_from": "2013", "year_to": "2018", "price_aed": "380"},
        {"part_type": "radiator", "make": "Lexus", "model": "ES", "year_from": "2013", "year_to": "2018", "price_aed": "390"},
        {"make": "Unknown", "model": "?", "part_type": "?", "year_from": "2013", "price_aed": "1"},
    ]
    job = client.post("/supplier/imports", json={"filename": "stock.csv", "rows": rows}, headers=supplier).json()
    assert (job["created"], job["duplicates"], len(job["errors"])) == (1, 1, 2)
    job2 = client.post("/supplier/imports", json={"filename": "stock.csv", "rows": [{**rows[0], "price_aed": "350"}]}, headers=supplier).json()
    assert job2["updated"] == 1 and job2["created"] == 0


def test_csv_file_upload(client, supplier):
    csv = "sku,part_type,make,model,year_from,year_to,price_aed\nF-1,starter,Toyota,Hilux,2016,2020,350\n"
    r = client.post("/supplier/imports/file", files={"file": ("stock.csv", csv.encode(), "text/csv")}, headers=supplier)
    assert r.status_code == 200 and r.json()["created"] + r.json()["updated"] == 1


def test_inventory_api_with_api_key(client, supplier):
    key = client.post("/supplier/api-key", headers=supplier).json()["apiKey"]
    h = {"X-API-Key": key}
    item = {"sku": "API-1", "part_type": "condenser", "make": "Kia", "model": "Sportage", "year_from": 2016, "year_to": 2021, "price_aed": 260}
    assert client.put("/integrations/inventory", json={"items": [item]}, headers=h).json()["created"] in (0, 1)
    assert client.put("/integrations/inventory", json={"items": [{**item, "price_aed": 240}]}, headers=h).json()["updated"] == 1
    assert client.delete("/integrations/inventory/API-1", headers=h).status_code == 200
    assert client.put("/integrations/inventory", json={"items": [item]}, headers={"X-API-Key": "bad"}).status_code == 401


# ------------------------------------------------- request → quotation flow

def test_request_quote_accept_flow_protects_contact_details(client, customer, supplier):
    body = {"make": "mercedes-benz", "model": "c-class", "year": 2016, "partTypeId": "gearbox", "emirate": "sharjah", "budget": 3000,
            "contactName": "Demo Customer", "contactPhone": "+971 50 111 2222", "contactMethod": "whatsapp"}
    r = client.post("/requests", json=body, headers=customer).json()
    rid = r["request"]["id"]
    assert r["matchedCount"] >= 1

    seen = next(x for x in client.get("/supplier/requests", headers=supplier).json() if x["request"]["id"] == rid)
    assert seen["request"]["contactPhone"] == "hidden until you are selected"

    q = {"requestId": rid, "price": 2600, "availability": "in-stock", "condition": "tested", "warrantyDays": 30, "deliveryDays": 1}
    assert client.post("/supplier/quotations", json=q, headers=supplier).status_code == 200
    mine = next(x for x in client.get("/me/requests", headers=customer).json() if x["request"]["id"] == rid)
    qid = mine["quotations"][0]["id"]
    accepted = client.post(f"/quotations/{qid}/accept", headers=customer).json()
    assert accepted["url"].startswith("https://wa.me/")

    seen = next(x for x in client.get("/supplier/requests", headers=supplier).json() if x["request"]["id"] == rid)
    assert seen["request"]["contactPhone"] == "+971 50 111 2222" and seen["myQuotation"]["status"] == "accepted"
    assert client.post("/supplier/quotations", json=q, headers=supplier).status_code == 400  # closed


def test_guest_request_spam_limit(client):
    body = {"make": "toyota", "model": "camry", "year": 2019, "partTypeId": "radiator", "emirate": "dubai",
            "contactName": "Guest", "contactPhone": "+971 55 999 0000"}
    codes = [client.post("/requests", json=body).status_code for _ in range(4)]
    assert codes[:3] == [200, 200, 200] and codes[3] == 429


# ------------------------------------------------------------ admin flow

def test_supplier_registration_requires_admin_approval(client, admin):
    email = f"s-{uuid.uuid4().hex[:6]}@uaeph-test.ae"
    reg = client.post("/auth/register-supplier", json={
        "businessName": "Test Breakers", "tradeLicence": "TL-1234", "contactName": "Owner", "phone": "+971501234567",
        "whatsapp": "+971501234567", "email": email, "password": "longpassword", "emirate": "sharjah", "area": "al-sajaa",
        "address": "Shop 1", "makes": ["toyota"], "categories": ["engine"], "docs": [{"name": "licence.pdf", "sizeKb": 100}],
    }).json()
    sid = reg["supplier"]["id"]
    assert reg["supplier"]["status"] == "pending"
    assert all(s["id"] != sid for s in client.get("/suppliers").json())

    h = {"Authorization": f"Bearer {reg['token']}"}
    part = client.post("/supplier/parts", json={**PART, "make": "toyota"}, headers=h).json()
    assert part["moderation"] == "pending"
    assert client.get(f"/parts/{part['id']}").status_code == 404

    assert client.post(f"/admin/suppliers/{sid}/status", json={"status": "approved"}, headers=admin).status_code == 200
    assert any(s["id"] == sid for s in client.get("/suppliers").json())
    assert client.get(f"/parts/{part['id']}").status_code == 200
    assert any(a["action"] == "supplier.approved" and a["target"] == sid for a in client.get("/admin/audit", headers=admin).json())

    assert client.post(f"/admin/suppliers/{sid}/status", json={"status": "suspended"}, headers=admin).status_code == 200
    r = client.post("/auth/login", json={"email": email, "password": "longpassword"})
    assert r.status_code == 403


def test_admin_dashboard_endpoints(client, admin):
    ov = client.get("/admin/overview", headers=admin).json()
    assert ov["suppliers"]["approved"] >= 10 and len(ov["charts"]["inventory"]) == 8
    pending = client.get("/admin/listings", params={"filter": "pending"}, headers=admin).json()["parts"]
    if pending:
        assert client.post(f"/admin/listings/{pending[0]['id']}/moderate", json={"decision": "approved"}, headers=admin).status_code == 200
    for path in ("/admin/suppliers", "/admin/duplicates", "/admin/imports", "/admin/inquiries", "/admin/reports", "/admin/audit"):
        assert client.get(path, headers=admin).status_code == 200, path


def test_report_and_resolve(client, admin):
    pid = client.get("/parts/search").json()["results"][0]["part"]["id"]
    assert client.post(f"/parts/{pid}/report", json={"reason": "Photo does not match"}).status_code == 200
    rep = next(r for r in client.get("/admin/reports", headers=admin).json() if r["report"]["partId"] == pid and r["report"]["status"] == "open")
    assert client.post(f"/admin/reports/{rep['report']['id']}/resolve", json={"action": "dismiss"}, headers=admin).status_code == 200


# --------------------------------------------------------- customer extras

def test_favourites_vehicles_and_account_deletion(client):
    email = f"d-{uuid.uuid4().hex[:6]}@uaeph-test.ae"
    tok = client.post("/auth/register", json={"name": "Del Me", "email": email, "password": "longpassword"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    pid = client.get("/parts/search").json()["results"][0]["part"]["id"]
    assert client.post(f"/me/favourites/{pid}", headers=h).json() == {"favourite": True}
    assert len(client.get("/me/favourites", headers=h).json()["parts"]) == 1
    assert client.post("/me/vehicles", json={"make": "toyota", "model": "camry", "year": 2019, "vin": "BADVIN"}, headers=h).status_code == 422
    assert client.post("/me/vehicles", json={"make": "toyota", "model": "camry", "year": 2019}, headers=h).status_code == 200
    assert client.delete("/me", headers=h).status_code == 200
    assert client.get("/auth/me", headers=h).status_code == 401


def test_ai_search_falls_back_to_rules_without_key(client):
    r = client.post("/ai/search", json={"q": "I need a used gearbox for a 2015 Mercedes C200 in Sharjah under AED 3,000"}).json()
    assert r["extractor"] == "rules" and r["parsed"]["make"] == "mercedes-benz"
    assert all(row["part"]["price"] <= 3000 for row in r["results"])


def test_demo_accounts_exist(client):
    for email in ("admin@demo.ae", "supplier@demo.ae", "customer@demo.ae"):
        login(client, email)
