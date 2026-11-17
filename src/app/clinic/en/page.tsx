import { permanentRedirect } from "next/navigation";

/** The English website moved to /clinic; keep old /clinic/en links working. */
export default function ClinicSiteEn() {
  permanentRedirect("/clinic");
}
