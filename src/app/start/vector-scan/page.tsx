import { FunnelPage, funnelMetadata } from "../funnel";
import type { SP } from "../LandingView";

export const dynamic = "force-dynamic";
export const generateMetadata = () => funnelMetadata("vector-scan", "tl");

export default function Page({ searchParams }: { searchParams: Promise<SP> }) {
  return <FunnelPage funnel="vector-scan" lang="tl" searchParams={searchParams} />;
}
