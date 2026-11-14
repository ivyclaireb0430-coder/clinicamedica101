import { SiteView, siteMetadata } from "../SiteView";

export const dynamic = "force-dynamic";
export const generateMetadata = () => siteMetadata("en");

/** Public clinic website (English). */
export default function ClinicSiteEn() {
  return <SiteView lang="en" />;
}
