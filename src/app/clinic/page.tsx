import { SiteView, siteMetadata } from "./SiteView";

export const dynamic = "force-dynamic";
export const generateMetadata = () => siteMetadata("en");

/** Public clinic website (English, the main version). Services and text are edited under More → Website. */
export default function ClinicSite() {
  return <SiteView lang="en" />;
}
