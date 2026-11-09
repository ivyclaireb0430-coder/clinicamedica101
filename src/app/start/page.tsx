import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { lines, parseFaq } from "@/lib/funnel";
import { UI } from "@/lib/landing-content";
import { LandingView, loadLandingBase, type SP } from "./LandingView";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [name, headline] = await Promise.all([getSetting("clinicName"), getSetting("landingHeadline")]);
  return {
    title: name,
    description: headline,
    robots: { index: true, follow: true },
    icons: { icon: "/landing/logo.jpg" },
    openGraph: { title: name, description: headline, images: ["/landing/doctor.jpg"] },
  };
}

/** General landing page. Its text is edited under More → Landing page. */
export default async function LandingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [sp, base, headline, sub, offer, benefits, faq, cta] = await Promise.all([
    searchParams, loadLandingBase(), getSetting("landingHeadline"), getSetting("landingSubheadline"), getSetting("landingOffer"),
    getSetting("landingBenefits"), getSetting("landingFaq"), getSetting("landingCta"),
  ]);
  return (
    <LandingView
      pageId="start"
      sp={sp}
      base={base}
      copy={{ headline, sub, offer, benefits: lines(benefits), faq: parseFaq(faq), cta: cta || UI.tl.schedule }}
      showPromo
    />
  );
}
