/** Public URL of the deployment (used for canonical URLs, sitemap and structured data). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
