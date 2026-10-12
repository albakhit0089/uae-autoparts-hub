export type Emirate =
  | "abu-dhabi"
  | "dubai"
  | "sharjah"
  | "ajman"
  | "umm-al-quwain"
  | "ras-al-khaimah"
  | "fujairah";

export type Condition = "used" | "tested" | "refurbished";
export type ListingStatus = "available" | "reserved" | "sold";
export type Compatibility = "verified" | "likely" | "confirm";
export type Role = "customer" | "supplier" | "admin";
export type SupplierStatus = "pending" | "approved" | "suspended" | "rejected";
export type Moderation = "approved" | "pending" | "rejected";
export type RecordSource = "dashboard" | "csv" | "api" | "partner" | "sample";
export type MarketSpec = "GCC" | "Imported" | "Unknown";

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  supplierId?: string;
  passwordHash: string;
  createdAt: string;
  marketingConsent: boolean;
  whatsappConsent: boolean;
}

export interface SupplierDoc {
  name: string;
  kind: "trade-licence" | "emirates-id" | "other";
  uploadedAt: string;
  sizeKb: number;
}

export interface Supplier {
  id: string;
  name: string;
  nameAr?: string;
  tradeLicence: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  email: string;
  emirate: Emirate;
  area: string;
  address: string;
  lat: number;
  lng: number;
  emiratesServed: Emirate[];
  makes: string[];
  categories: string[];
  status: SupplierStatus;
  docs: SupplierDoc[];
  delivery: boolean;
  featured: boolean;
  apiKey?: string;
  plan: string;
  createdAt: string;
  isSample: boolean;
}

export interface Part {
  id: string;
  supplierId: string;
  /** Supplier stock-keeping reference, used to update records on re-import / API sync. */
  sku?: string;
  name: string;
  categoryId: string;
  partTypeId: string;
  oem?: string;
  make: string;
  model: string;
  generation?: string;
  yearFrom: number;
  yearTo: number;
  engine?: string;
  transmission?: string;
  marketSpec: MarketSpec;
  condition: Condition;
  price: number;
  quantity: number;
  warrantyDays: number;
  emirate: Emirate;
  area: string;
  images: string[];
  description: string;
  donorVehicle?: string;
  status: ListingStatus;
  lastVerified: string;
  createdAt: string;
  views: number;
  featured: boolean;
  /** Fitment evidence provided by the supplier for this listing. */
  fitment: Compatibility;
  moderation: Moderation;
  source: RecordSource;
  isSample: boolean;
}

export interface Inquiry {
  id: string;
  partId: string;
  supplierId: string;
  customerId?: string;
  guestName?: string;
  message: string;
  channel: "whatsapp";
  createdAt: string;
}

export interface PartRequest {
  id: string;
  customerId?: string;
  contactName: string;
  /** Only disclosed to suppliers once the customer accepts their quotation. */
  contactPhone: string;
  contactEmail?: string;
  contactMethod: "whatsapp" | "phone" | "email";
  make: string;
  model: string;
  year: number;
  engine?: string;
  partTypeId: string;
  partText: string;
  oem?: string;
  emirate: Emirate;
  budget?: number;
  description: string;
  images: string[];
  status: "open" | "closed";
  matchedSupplierIds: string[];
  createdAt: string;
}

export interface Quotation {
  id: string;
  requestId: string;
  supplierId: string;
  price: number;
  availability: "in-stock" | "1-3-days" | "on-order";
  condition: Condition;
  warrantyDays: number;
  deliveryDays: number;
  note: string;
  images: string[];
  status: "submitted" | "accepted" | "declined";
  createdAt: string;
}

export interface ImportJob {
  id: string;
  supplierId: string;
  filename: string;
  createdAt: string;
  total: number;
  created: number;
  updated: number;
  duplicates: number;
  errors: { row: number; message: string }[];
}

export interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  target: string;
  at: string;
}

export interface Report {
  id: string;
  partId: string;
  reporterId?: string;
  reason: string;
  status: "open" | "resolved";
  createdAt: string;
}

export interface SavedVehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: number;
  engine?: string;
  vin?: string;
}

export interface Plan {
  id: string;
  name: string;
  priceAed: number;
  listingLimit: number;
  featuredSlots: number;
  active: boolean;
}

export interface SearchFilters {
  q?: string;
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
  transmission?: string;
  category?: string;
  partType?: string;
  oem?: string;
  emirate?: Emirate;
  area?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: Condition;
  warranty?: boolean;
  sort?: "relevance" | "price-asc" | "price-desc" | "newest";
}
