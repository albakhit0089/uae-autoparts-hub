/**
 * Production client for the FastAPI backend (api/). Same contract as the demo
 * backend so pages are agnostic of the data source. JWT is kept in
 * sessionStorage; the API enforces all permissions server-side.
 */
import type { Backend } from "./demo-backend";
import { ApiError } from "./demo-backend";
import type { RawRow } from "./importer";
import type { SearchFilters } from "./types";

const TOKEN = "uaeph-token";

export function httpBackend(base: string): Backend {
  const root = base.replace(/\/$/, "");
  const token = () => {
    try {
      return sessionStorage.getItem(TOKEN);
    } catch {
      return null;
    }
  };
  const changed = () => window.dispatchEvent(new Event("uaeph:changed"));

  async function req<T>(method: string, path: string, body?: unknown, mutate = method !== "GET"): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const tk = token();
    if (tk) headers.Authorization = `Bearer ${tk}`;
    const res = await fetch(`${root}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = await res.json();
        msg = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d: { msg: string }) => d.msg).join("; ") : msg;
      } catch {
        /* ignore */
      }
      throw new ApiError(msg, res.status);
    }
    const data = res.status === 204 ? (undefined as T) : ((await res.json()) as T);
    if (mutate) changed();
    return data;
  }

  const qs = (f: object) =>
    "?" +
    Object.entries(f)
      .filter(([, v]) => v !== undefined && v !== "" && v !== null && v !== false)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");

  const setToken = (t: string | null) => {
    try {
      if (t) sessionStorage.setItem(TOKEN, t);
      else sessionStorage.removeItem(TOKEN);
    } catch {
      /* ignore */
    }
  };

  const b: Backend = {
    mode: "demo" as never,
    async reset() {
      throw new ApiError("Reset is only available in demo mode");
    },
    async currentUser() {
      if (!token()) return null;
      try {
        return await req("GET", "/auth/me");
      } catch {
        setToken(null);
        return null;
      }
    },
    async login(email, password) {
      const r = await req<{ token: string; user: never }>("POST", "/auth/login", { email, password }, false);
      setToken(r.token);
      changed();
      return r.user;
    },
    async logout() {
      setToken(null);
      changed();
    },
    async registerCustomer(input) {
      const r = await req<{ token: string; user: never }>("POST", "/auth/register", input, false);
      setToken(r.token);
      changed();
      return r.user;
    },
    async registerSupplier(input) {
      const r = await req<{ token: string; supplier: never }>("POST", "/auth/register-supplier", input, false);
      setToken(r.token);
      changed();
      return r.supplier;
    },
    search: (f: SearchFilters) => req("GET", `/parts/search${qs(f)}`),
    featured: (limit = 8) => req("GET", `/parts/featured?limit=${limit}`),
    recent: (limit = 8) => req("GET", `/parts/recent?limit=${limit}`),
    getPart: (id) => req("GET", `/parts/${encodeURIComponent(id)}`),
    compare: (id) => req("GET", `/parts/${encodeURIComponent(id)}/compare`),
    listSuppliers: () => req("GET", "/suppliers"),
    getSupplier: (id) => req("GET", `/suppliers/${encodeURIComponent(id)}`),
    logInquiry: (partId, lang, guestName) => req("POST", "/inquiries", { partId, lang, guestName }, false),
    reportListing: (partId, reason) => req("POST", `/parts/${encodeURIComponent(partId)}/report`, { reason }),
    createRequest: (input) => req("POST", "/requests", input),
    myRequests: () => req("GET", "/me/requests"),
    acceptQuotation: (id) => req("POST", `/quotations/${id}/accept`),
    closeRequest: (id) => req("POST", `/requests/${id}/close`),
    favourites: () => req("GET", "/me/favourites"),
    async isFavourite(partId) {
      if (!token()) return false;
      const r = await req<{ favourite: boolean }>("GET", `/me/favourites/${partId}`);
      return r.favourite;
    },
    async toggleFavourite(partId) {
      const r = await req<{ favourite: boolean }>("POST", `/me/favourites/${partId}`);
      return r.favourite;
    },
    savedVehicles: () => req("GET", "/me/vehicles"),
    addVehicle: (v) => req("POST", "/me/vehicles", v),
    removeVehicle: (id) => req("DELETE", `/me/vehicles/${id}`),
    myInquiries: () => req("GET", "/me/inquiries"),
    updatePreferences: (p) => req("PATCH", "/me", p),
    async deleteAccount() {
      await req("DELETE", "/me");
      setToken(null);
      changed();
    },
    mySupplier: () => req("GET", "/supplier/me"),
    updateSupplier: (p) => req("PATCH", "/supplier/me", p),
    uploadSupplierDoc: (d) => req("POST", "/supplier/documents", d),
    myParts: () => req("GET", "/supplier/parts"),
    savePart: (p) => (p.id ? req("PUT", `/supplier/parts/${p.id}`, p) : req("POST", "/supplier/parts", p)),
    setPartStatus: (id, status) => req("POST", `/supplier/parts/${id}/status`, { status }),
    verifyStock: (ids) => req("POST", "/supplier/parts/verify", { ids }),
    deletePart: (id) => req("DELETE", `/supplier/parts/${id}`),
    importRows: (filename: string, rows: RawRow[]) => req("POST", "/supplier/imports", { filename, rows }),
    myImports: () => req("GET", "/supplier/imports"),
    supplierInquiries: () => req("GET", "/supplier/inquiries"),
    matchedRequests: () => req("GET", "/supplier/requests"),
    submitQuotation: (q) => req("POST", "/supplier/quotations", q),
    supplierStats: () => req("GET", "/supplier/stats"),
    async regenerateApiKey() {
      const r = await req<{ apiKey: string }>("POST", "/supplier/api-key");
      return r.apiKey;
    },
    adminOverview: () => req("GET", "/admin/overview"),
    adminSuppliers: () => req("GET", "/admin/suppliers"),
    setSupplierStatus: (id, status) => req("POST", `/admin/suppliers/${id}/status`, { status }),
    toggleSupplierFeatured: (id) => req("POST", `/admin/suppliers/${id}/feature`),
    adminListings: (filter) => req("GET", `/admin/listings?filter=${filter}`),
    moderatePart: (id, decision) => req("POST", `/admin/listings/${id}/moderate`, { decision }),
    toggleFeatured: (id) => req("POST", `/admin/listings/${id}/feature`),
    adminDuplicates: () => req("GET", "/admin/duplicates"),
    adminRemovePart: (id) => req("DELETE", `/admin/listings/${id}`),
    adminImports: () => req("GET", "/admin/imports"),
    adminInquiries: () => req("GET", "/admin/inquiries"),
    adminReports: () => req("GET", "/admin/reports"),
    resolveReport: (id, action) => req("POST", `/admin/reports/${id}/resolve`, { action }),
    plans: () => req("GET", "/plans"),
    updatePlan: (id, patch) => req("PATCH", `/admin/plans/${id}`, patch),
    auditLog: () => req("GET", "/admin/audit"),
  };
  return b;
}
