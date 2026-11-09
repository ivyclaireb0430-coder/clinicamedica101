import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatPhp } from "@/lib/time";
import { UI, funnelCopy, pagePath, type FunnelKey, type Lang, type LandingPageId } from "@/lib/landing-content";
import { LandingView, loadLandingBase, type LandingBase, type SP } from "./LandingView";

// Dedicated funnels (Vector Scan, Consultation) in Taglish and English. Copy lives in lib/landing-content.ts;
// prices come from settings (promo) and consultation types (fees).

function seniorFee(note: string): string {
  return note.match(/₱\s?[\d,]+/)?.[0]?.replace(/\s/g, "") ?? "";
}

async function copyFor(funnel: FunnelKey, lang: Lang, base: LandingBase) {
  const consult = await db.consultationType.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return funnelCopy(funnel, lang, {
    doctor: base.landingDoctorName,
    promoName: base.promo?.name || "Vector Scan",
    promoPrice: base.promo?.price ? formatPhp(base.promo.price) : "",
    promoOld: base.promo?.old ? formatPhp(base.promo.old) : "",
    consultFee: consult ? formatPhp(consult.feePhp) : "",
    seniorFee: seniorFee(base.landingFeeNote),
  });
}

export async function funnelMetadata(funnel: FunnelKey, lang: Lang): Promise<Metadata> {
  const base = await loadLandingBase();
  const copy = await copyFor(funnel, lang, base);
  return {
    title: `${copy.cta} · Clinica Medica 101`,
    description: copy.sub,
    robots: { index: true, follow: true },
    icons: { icon: "/landing/logo.jpg" },
    openGraph: { title: copy.headline, description: copy.sub, images: ["/landing/doctor.jpg"] },
  };
}

export async function FunnelPage({ funnel, lang, searchParams }: { funnel: FunnelKey; lang: Lang; searchParams: Promise<SP> }) {
  const [sp, base] = await Promise.all([searchParams, loadLandingBase()]);
  const copy = await copyFor(funnel, lang, base);
  const pageId = (lang === "en" ? `${funnel}/en` : funnel) as LandingPageId;
  const other: FunnelKey = funnel === "vector-scan" ? "consultation" : "vector-scan";
  const otherId = (lang === "en" ? `${other}/en` : other) as LandingPageId;
  const t = UI[lang];
  const showCross = other === "consultation" || Boolean(base.promo);
  return (
    <LandingView
      pageId={pageId}
      sp={sp}
      base={base}
      copy={copy}
      showPromo={funnel === "vector-scan"}
      promoFirst={funnel === "vector-scan"}
      crossLink={showCross ? { text: t.otherFunnel[funnel], label: t.seeOther[funnel], href: pagePath(otherId) } : undefined}
    />
  );
}
