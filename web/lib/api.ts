import { demoBackend, type Backend } from "./demo-backend";
import { httpBackend } from "./http-backend";

/** When NEXT_PUBLIC_API_URL is set the app talks to the FastAPI backend; otherwise it runs in demo mode. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
export const api: Backend = API_URL ? httpBackend(API_URL) : demoBackend;
export const isDemo = !API_URL;
export { ApiError } from "./demo-backend";
