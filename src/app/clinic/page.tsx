import { SiteView, siteMetadata } from "./SiteView";

export const dynamic = "force-dynamic";
export const generateMetadata = () => siteMetadata("tl");

/** Public clinic website (Taglish). Services and text are edited under More → Website. */
export default function ClinicSite() {
  return <SiteView lang="tl" />;
}
