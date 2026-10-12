import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Static sitemap of public landing pages. When the API is connected, the
 * backend also serves /sitemap-parts.xml listing every live part page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const urls = ["/", "/search/", "/suppliers/", "/request/", "/register/supplier/", "/legal/privacy/", "/legal/terms/", "/legal/safety/"];
  return urls.map((u) => ({ url: `${SITE_URL}${u}`, lastModified: now, changeFrequency: "daily", priority: u === "/" ? 1 : 0.7 }));
}
