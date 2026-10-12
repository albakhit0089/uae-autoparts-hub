import type { Metadata } from "next";
import { notFound } from "next/navigation";

const DOCS: Record<string, { title: string; body: [string, string][] }> = {
  privacy: {
    title: "Privacy notice",
    body: [
      ["Draft — legal review required", "This notice is a working draft prepared for the MVP. It has not been reviewed by a UAE-qualified lawyer and does not by itself establish compliance with the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021) or any free-zone data regime."],
      ["What we collect", "Account details (name, email, phone), saved vehicles and favourites, part requests and photos you upload, inquiry logs (which listing you contacted, when), and for suppliers: business details, trade licence documents and inventory data."],
      ["Why", "To run the marketplace: show inventory, route part requests to relevant suppliers, prevent spam and fraud, verify suppliers, and keep audit records."],
      ["Sharing", "Customer phone numbers and emails on part requests are not shown to suppliers until the customer accepts that supplier’s quotation. WhatsApp chats happen directly between you and the supplier on WhatsApp."],
      ["Location", "If you choose “sort by distance”, your device location is used in your browser only and is not stored."],
      ["Retention", "Inquiry logs are kept for 24 months, closed part requests for 12 months, supplier verification documents for the life of the account plus 12 months, then deleted or anonymised."],
      ["Your rights", "You can view, export, correct and delete your account data from “My account”, or by contacting support@example.com."],
    ],
  },
  terms: {
    title: "Terms of use",
    body: [
      ["Draft — legal review required", "These terms are a working draft for the MVP and must be reviewed before commercial launch."],
      ["Role of the platform", "UAE AutoParts Hub is a listing and inquiry platform. Parts are sold by independent suppliers. We do not take part in the sale, payment or delivery during the MVP phase."],
      ["Supplier obligations", "Suppliers must hold a valid UAE trade licence, list only parts they physically hold or can source, describe condition honestly, keep stock status current, and use only photographs they own."],
      ["Compatibility", "Fitment labels (verified / likely / confirm) are guidance based on data provided by suppliers. Always confirm the OEM part number or VIN with the supplier before purchase."],
      ["Prohibited", "Stolen parts, counterfeit parts presented as genuine, recalled safety parts, spam, scraping and abusive messages are prohibited and lead to removal."],
    ],
  },
  safety: {
    title: "Safety-critical parts policy",
    body: [
      ["Scope", "Brakes, ABS, airbags, steering, suspension and similar components are flagged as safety-critical in our taxonomy."],
      ["Listing controls", "Safety-critical listings require an OEM part number and are held for administrator review before going live. Airbag modules must not be listed if deployed or crash-damaged."],
      ["Buyer guidance", "Have safety-critical used parts installed and inspected by a qualified workshop. Ask the supplier for the donor vehicle details and any test results."],
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: DOCS[slug]?.title ?? "Legal", alternates: { canonical: `/legal/${slug}/` } };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-3xl font-bold text-navy-900 dark:text-white">{doc.title}</h1>
      <div className="mt-8 space-y-6">
        {doc.body.map(([h, p]) => (
          <section key={h} className={h.startsWith("Draft") ? "rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" : ""}>
            <h2 className="mb-1 font-semibold">{h}</h2>
            <p className="text-sm leading-relaxed text-charcoal-700 dark:text-charcoal-300">{p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
