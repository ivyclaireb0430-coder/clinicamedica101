import { SiteView, siteMetadata } from "../SiteView";

export const dynamic = "force-dynamic";
export const generateMetadata = () => siteMetadata("tl");

/** Public clinic website (Taglish). */
export default function ClinicSiteTl() {
  return <SiteView lang="tl" />;
}
