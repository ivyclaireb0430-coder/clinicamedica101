export const dynamic = "force-dynamic"; // the AI section follows the live setting

import { getSetting } from "@/lib/settings";
import { aiEnabled } from "@/lib/messenger/ai-context";

export const metadata = { title: "Privacy Notice · Clinica Medica 101" };

export default async function PrivacyNotice() {
  const [name, address, ai, aiHealth] = await Promise.all([getSetting("clinicName"), getSetting("clinicAddress"), aiEnabled(), getSetting("aiHealthInquiries")]);
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6 text-sm leading-relaxed">
      <h1>Privacy Notice</h1>
      <p className="muted">{name} · {address}</p>
      <p>
        We respect your privacy and follow the Data Privacy Act of 2012 (RA 10173). This notice explains what we collect when
        you message us or book a consultation, and how we protect it.
      </p>
      <h2>What we collect</h2>
      <ul className="list-disc pl-5">
        <li>Your name, mobile number, email, and Messenger ID, to schedule and remind you of appointments.</li>
        <li>Health information you choose to share (for example, your concern), so the doctor can prepare for your consultation.</li>
        <li>Appointment history and how you heard about us.</li>
      </ul>
      <h2>How we use it</h2>
      <ul className="list-disc pl-5">
        <li>To answer your questions, book appointments, and send reminders through Messenger, email, or SMS.</li>
        <li>To provide medical care. Health information is only seen by the doctor and authorized clinical staff.</li>
        <li>We do not sell your data or use it for advertising. Testimonials are used only with your written consent.</li>
      </ul>
      <h2>How we protect it</h2>
      <p>
        Health information is encrypted, access is limited by role, every access is logged, and backups are encrypted.
        Clinical notes are never sent through Messenger, Google, or any AI service.
      </p>
      {ai && (
        <>
          <h2>AI assistant on Messenger</h2>
          <p>
            Some replies on Messenger are written by an AI assistant from Anthropic, our service provider. To write the reply,
            your recent messages are sent to the provider, with mobile numbers and emails removed.{" "}
            {aiHealth === "1"
              ? "This can include health concerns you write about (for example, symptoms), so the assistant can invite you to a consultation; the doctor also sees these messages."
              : "Messages about your health, symptoms, medicines or results are not sent to the AI; the doctor answers those personally."}{" "}
            Past replies of our staff, with patient names and contact details removed, are used as writing examples. The
            provider may only use the messages to provide this service, not to train its AI. The assistant never gives medical
            advice or a diagnosis. You can ask to talk to a person at any time by tapping &quot;Kausapin ang doktor&quot;.
          </p>
        </>
      )}
      <h2>Your rights</h2>
      <p>
        You may ask to see, correct, or delete your information, or withdraw consent, by messaging us on Facebook or telling
        the clinic staff. Some medical records must be kept for the period required by law.
      </p>
      <h2>Consent</h2>
      <p>
        By continuing to share your information with us, you agree to this notice. You can say no; we will still answer
        general questions about the clinic.
      </p>
      <p className="muted">Data Protection Officer: [name and contact, to be filled in by the clinic]</p>
    </main>
  );
}
