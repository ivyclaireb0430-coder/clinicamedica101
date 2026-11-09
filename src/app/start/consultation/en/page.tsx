import { FunnelPage, funnelMetadata } from "../../funnel";
import type { SP } from "../../LandingView";

export const dynamic = "force-dynamic";
export const generateMetadata = () => funnelMetadata("consultation", "en");

export default function Page({ searchParams }: { searchParams: Promise<SP> }) {
  return <FunnelPage funnel="consultation" lang="en" searchParams={searchParams} />;
}
