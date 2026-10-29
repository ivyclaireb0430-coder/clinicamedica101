// Fake demo data only. Never put real patient data here.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encrypt, encryptJson } from "../src/lib/crypto";
import { addDays, manilaToUtc, todayManila } from "../src/lib/time";
import { SCRIPTS } from "./seed-data";

const db = new PrismaClient();


const FIRST = ["Maria", "Jose", "Ana", "Juan", "Liza", "Mark", "Grace", "Paolo", "Carmela", "Ramon", "Joy", "Miguel", "Bea", "Carlo", "Rica", "Noel", "Trisha", "Dennis", "Aileen", "Rafael", "Kim", "Arnel", "Sheila", "Bong"];
const LAST = ["Santos", "Reyes", "Cruz", "Bautista", "Ocampo", "Garcia", "Mendoza", "Torres", "Villanueva", "Aquino", "Ramos", "Castillo", "Flores", "Navarro"];
const CONCERNS = [
  "Pabalik-balik na sakit ng ulo", "Pagod palagi kahit sapat ang tulog", "Gustong i-check ang overall health / prevention",
  "Hirap matulog", "Mataas na sugar sa huling lab test", "Sakit sa likod", "Acid reflux", "Gustong maintindihan ang lab results",
];
const SOURCES = ["MESSENGER", "MESSENGER", "MESSENGER", "FB_REEL", "REFERRAL", "RADIO", "WALK_IN"];

// Deterministic pseudo-random so the demo looks the same every reset.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to seed demo data in production");
  }
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe-Clinic-2026";

  await db.$transaction([
    db.auditLog.deleteMany(), db.packageUse.deleteMany(), db.payment.deleteMany(), db.charge.deleteMany(), db.patientPackage.deleteMany(), db.feedback.deleteMany(), db.progressEntry.deleteMany(), db.followUp.deleteMany(), db.treatmentSession.deleteMany(), db.treatmentConsent.deleteMany(), db.treatmentPlanItem.deleteMany(), db.treatmentPlan.deleteMany(), db.attachment.deleteMany(), db.assessment.deleteMany(), db.intakeForm.deleteMany(), db.patient.deleteMany(), db.reminder.deleteMany(), db.message.deleteMany(), db.conversation.deleteMany(), db.appointment.deleteMany(), db.leadStageChange.deleteMany(), db.lead.deleteMany(),
    db.campaign.deleteMany(), db.script.deleteMany(), db.consultationType.deleteMany(), db.scheduleRule.deleteMany(),
    db.blockedDate.deleteMany(), db.externalBusy.deleteMany(), db.googleAccount.deleteMany(), db.user.deleteMany(), db.setting.deleteMany(),
  ]);

  const owner = await db.user.create({
    data: { email: "owner@example.com", name: "Dr. Demo Owner", role: "OWNER", passwordHash: await bcrypt.hash(ownerPassword, 12) },
  });
  await db.user.create({
    data: { email: "frontdesk@example.com", name: "Demo Front Desk", role: "FRONT_DESK", passwordHash: await bcrypt.hash(ownerPassword, 12) },
  });

  for (const [i, s] of SCRIPTS.entries()) await db.script.create({ data: { ...s, sortOrder: i } });

  const types = await Promise.all([
    db.consultationType.create({ data: { name: "Initial consultation", description: "Full integrative assessment (sample fee, edit in Settings)", durationMin: 60, feePhp: 2500, sortOrder: 0 } }),
    db.consultationType.create({ data: { name: "Follow-up consultation", description: "Review of progress and plan (sample fee)", durationMin: 30, feePhp: 1500, sortOrder: 1 } }),
  ]);

  // Sample clinic hours: Mon–Fri 10:00–17:00, Sat 09:00–12:00.
  for (const weekday of [1, 2, 3, 4, 5]) await db.scheduleRule.create({ data: { weekday, startTime: "10:00", endTime: "17:00" } });
  await db.scheduleRule.create({ data: { weekday: 6, startTime: "09:00", endTime: "12:00" } });
  await db.blockedDate.create({ data: { date: "2026-11-01", reason: "All Saints' Day" } });
  await db.blockedDate.create({ data: { date: "2026-11-30", reason: "Bonifacio Day" } });

  const campaigns = await Promise.all([
    db.campaign.create({ data: { name: "Reel: Bakit pabalik-balik ang sakit ng ulo?", channel: "FB_REEL", trackingCode: "reel-headache" } }),
    db.campaign.create({ data: { name: "Radio guesting – DZ sample", channel: "RADIO", trackingCode: "radio-oct" } }),
    db.campaign.create({ data: { name: "Post: Ano ang integrative assessment?", channel: "FB_POST", trackingCode: "post-assessment" } }),
  ]);

  const today = todayManila();
  const stagePlan = [
    ...Array(7).fill("NEW"), ...Array(5).fill("REPLIED"), ...Array(5).fill("FEE_EXPLAINED"), ...Array(6).fill("BOOKED"),
    ...Array(6).fill("ATTENDED"), ...Array(4).fill("PLAN_ACCEPTED"), ...Array(3).fill("FOLLOW_UP"), ...Array(4).fill("LOST"),
  ];
  const order = ["NEW", "REPLIED", "FEE_EXPLAINED", "BOOKED", "ATTENDED", "PLAN_ACCEPTED", "FOLLOW_UP"];
  const usedSlots = new Set<string>();

  for (const [i, stage] of stagePlan.entries()) {
    const daysAgo = Math.floor(rand() * 40);
    const first = new Date(manilaToUtc(addDays(today, -daysAgo), "10:00").getTime() + Math.floor(rand() * 8) * 3_600_000);
    const source = pick(SOURCES);
    const campaign = source === "FB_REEL" ? campaigns[0] : source === "RADIO" ? campaigns[1] : rand() < 0.2 ? campaigns[2] : null;
    const firstName = FIRST[i % FIRST.length];
    const lastName = pick(LAST);
    const reached = stage === "LOST" ? order.slice(0, 1 + Math.floor(rand() * 3)) : order.slice(0, order.indexOf(stage) + 1);
    const stamps = reached.map((_, k) => new Date(first.getTime() + k * 86_400_000 * (1 + Math.floor(rand() * 3))));
    const lastContact = stage === "LOST" ? stamps[stamps.length - 1] : stamps[stamps.length - 1] > new Date() ? new Date() : stamps[stamps.length - 1];

    const lead = await db.lead.create({
      data: {
        firstName, lastName,
        psid: source === "MESSENGER" ? `demo-psid-${1000 + i}` : null,
        mobile: `0917${String(1000000 + i * 7919).slice(-7)}`,
        email: rand() < 0.5 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com` : null,
        source, campaignId: campaign?.id ?? null,
        concernEnc: encrypt(pick(CONCERNS)),
        stage, lostReason: stage === "LOST" ? pick(["Price / budget", "No reply", "Only wanted quick fix / medicine"]) : null,
        privacyConsent: true, consentAt: first, firstContactAt: first, lastContactAt: lastContact,
        stageChanges: {
          create: [
            ...reached.map((s, k) => ({ fromStage: k ? reached[k - 1] : null, toStage: s, createdAt: stamps[k], userId: owner.id })),
            ...(stage === "LOST" ? [{ fromStage: reached[reached.length - 1], toStage: "LOST", createdAt: lastContact, userId: owner.id }] : []),
          ],
        },
      },
    });

    // Appointments for leads that reached BOOKED.
    if (reached.includes("BOOKED")) {
      const upcoming = stage === "BOOKED";
      let day = upcoming ? addDays(today, 1 + Math.floor(rand() * 10)) : addDays(today, -Math.max(1, Math.floor(rand() * 20)));
      while ([0].includes(new Date(`${day}T00:00:00Z`).getUTCDay()) || ["2026-11-01", "2026-11-30"].includes(day)) day = addDays(day, 1);
      let hour = 10 + Math.floor(rand() * 6);
      if (new Date(`${day}T00:00:00Z`).getUTCDay() === 6) hour = 9 + Math.floor(rand() * 2);
      while (usedSlots.has(`${day}-${hour}`)) hour = hour >= 15 ? 10 : hour + 1;
      usedSlots.add(`${day}-${hour}`);
      const type = types[0];
      const startAt = manilaToUtc(day, `${String(hour).padStart(2, "0")}:00`);
      await db.appointment.create({
        data: {
          leadId: lead.id, consultationTypeId: type.id, startAt, endAt: new Date(startAt.getTime() + type.durationMin * 60_000),
          status: upcoming ? (rand() < 0.5 ? "CONFIRMED" : "BOOKED") : "ATTENDED",
          channel: source === "MESSENGER" ? "MESSENGER" : "STAFF",
          createdAt: stamps[reached.indexOf("BOOKED")] < new Date() ? stamps[reached.indexOf("BOOKED")] : new Date(),
        },
      });
    }
  }

  // A couple of no-shows and today's appointments for the demo.
  const noShowLeads = await db.lead.findMany({ where: { stage: "FEE_EXPLAINED" }, take: 2 });
  for (const [k, l] of noShowLeads.entries()) {
    const startAt = manilaToUtc(addDays(today, -(3 + k)), "14:00");
    await db.appointment.create({
      data: { leadId: l.id, consultationTypeId: types[0].id, startAt, endAt: new Date(startAt.getTime() + 3_600_000), status: "NO_SHOW" },
    });
  }
  const todayLeads = await db.lead.findMany({ where: { stage: "REPLIED" }, take: 2 });
  for (const [k, l] of todayLeads.entries()) {
    const startAt = manilaToUtc(today, k ? "16:00" : "11:30");
    await db.appointment.create({
      data: { leadId: l.id, consultationTypeId: types[1].id, startAt, endAt: new Date(startAt.getTime() + 30 * 60_000), status: "CONFIRMED" },
    });
    await db.lead.update({ where: { id: l.id }, data: { stage: "BOOKED" } });
    await db.leadStageChange.create({ data: { leadId: l.id, fromStage: "REPLIED", toStage: "BOOKED", userId: owner.id } });
  }

  // Demo Messenger conversations (fake).
  const messengerLeads = await db.lead.findMany({ where: { psid: { not: null } }, orderBy: { lastContactAt: "desc" }, take: 6 });
  const demoThreads: [string, string, string][][] = [
    [["IN", "PATIENT", "Hi po, magkano po consultation?"], ["OUT", "BOT", "Ang consultation fee po ay ₱2,500. Kasama na po dito ang mahabang one-on-one na assessment…"], ["IN", "PATIENT", "Doc, may sakit po ako sa tiyan tuwing gabi, ano po dapat inumin?"], ["OUT", "BOT", "Salamat po sa pagbahagi. Para masagot ito nang tama at ligtas, ipapasa ko po ito sa doktor…"]],
    [["IN", "PATIENT", "Hello"], ["OUT", "BOT", "Hi! Salamat sa pag-message sa Clinica Medica 101…"], ["IN", "PATIENT", "Mag-book"], ["OUT", "BOT", "Pumili po ng oras na pinaka-convenient sa inyo:"]],
    [["IN", "PATIENT", "Saan po kayo?"], ["OUT", "BOT", "Nasa Centuria Medical Makati po kami…"]],
  ];
  for (const [i, lead] of messengerLeads.entries()) {
    const thread = demoThreads[i % demoThreads.length];
    const last = new Date(Date.now() - (i + 1) * 3 * 3_600_000);
    await db.conversation.create({
      data: {
        leadId: lead.id, psid: lead.psid!, needsDoctor: i === 0, needsDoctorAt: i === 0 ? last : null,
        automationPaused: i === 2, pausedAt: i === 2 ? last : null, lastUserMessageAt: last, lastMessageAt: last, unread: i < 2 ? 1 : 0,
        messages: {
          create: thread.map(([direction, sender, text], k) => ({
            direction, sender, textEnc: encrypt(text), createdAt: new Date(last.getTime() - (thread.length - k) * 60_000),
          })),
        },
      },
    });
  }

  // Patients: everyone who attended or went further, with fake clinical records.
  const attendedLeads = await db.lead.findMany({ where: { stage: { in: ["ATTENDED", "PLAN_ACCEPTED", "FOLLOW_UP"] } }, orderBy: { firstContactAt: "asc" } });
  const MODALITIES = [["Lifestyle & nutrition counseling", 1500], ["Acupuncture", 1800], ["Therapeutic massage", 1200], ["IV nutrient therapy", 3500]] as const;
  for (const [i, lead] of attendedLeads.entries()) {
    const patient = await db.patient.create({
      data: {
        patientNo: `CM-${String(i + 1).padStart(4, "0")}`, leadId: lead.id, firstName: lead.firstName, lastName: lead.lastName,
        birthDate: `19${60 + ((i * 7) % 35)}-0${1 + (i % 9)}-1${i % 9}`, sex: i % 2 ? "MALE" : "FEMALE", mobile: lead.mobile, email: lead.email,
        address: pick(["Makati City", "Taguig City", "Pasig City", "Quezon City", "Mandaluyong City"]), privacyConsent: true, consentAt: lead.consentAt,
      },
    });
    const appt = await db.appointment.findFirst({ where: { leadId: lead.id, status: "ATTENDED" } });
    const visit = appt?.startAt ?? lead.lastContactAt;
    await db.intakeForm.create({
      data: {
        token: `demo-intake-${i}`, expiresAt: visit, leadId: lead.id, patientId: patient.id, status: "SUBMITTED", consentGiven: true,
        consentVersion: "2026-10", submittedAt: new Date(visit.getTime() - 86_400_000),
        answersEnc: encryptJson({ chiefComplaint: pick(CONCERNS), medications: "Wala", allergies: "Wala", lifestyle: "Kulang sa tulog, mataas ang stress sa trabaho", goals: "Maintindihan ang pinagmumulan ng problema" }),
      },
    });
    await db.assessment.create({
      data: {
        patientId: patient.id, appointmentId: appt?.id, date: visit, authorId: owner.id,
        chiefComplaintEnc: encrypt(pick(CONCERNS)), symptomsEnc: encrypt("[Demo] Fake history for testing only."),
        examEnc: encrypt("[Demo] BP 120/80, HR 76. Unremarkable exam."), investigationsEnc: encrypt("[Demo] CBC, FBS, lipid profile"),
        explainedEnc: encrypt("[Demo] Explained possible contributing factors and the next steps."),
      },
    });
    if (lead.stage !== "ATTENDED") {
      const chosen = [MODALITIES[i % 4], MODALITIES[(i + 1) % 4]];
      const plan = await db.treatmentPlan.create({
        data: {
          patientId: patient.id, title: "Initial plan", status: "STARTED", authorId: owner.id, startedAt: visit,
          goalsEnc: encrypt("[Demo] Improve sleep and energy; reassess in 4 weeks."), scheduleEnc: encrypt("Once a week for 6 weeks"),
          benefitsEnc: encrypt("[Demo] May help improve symptoms; results vary."), risksEnc: encrypt("[Demo] Mild soreness, bruising."),
          alternativesEnc: encrypt("[Demo] Lifestyle changes alone; referral to specialist; no treatment."),
          items: { create: chosen.map(([modality, price], k) => ({ modality, sessions: k ? 4 : 6, unitPricePhp: price, sortOrder: k })) },
        },
      });
      await db.treatmentConsent.create({
        data: {
          planId: plan.id, consentDate: visit.toISOString().slice(0, 10), explainedById: owner.id, explainedByName: owner.name,
          patientAcknowledged: true, acknowledgement: "Plan, costs, benefits, risks and alternatives explained. Patient agreed.",
        },
      });
      for (let k = 0; k < 2 + (i % 3); k++) {
        if (new Date(visit.getTime() + (k + 1) * 7 * 86_400_000).toISOString().slice(0, 10) > today) break;
        await db.treatmentSession.create({
          data: {
            planId: plan.id, patientId: patient.id, authorId: owner.id, modality: chosen[k % 2][0],
            date: new Date(visit.getTime() + (k + 1) * 7 * 86_400_000).toISOString().slice(0, 10),
            progressNotesEnc: encrypt(`[Demo] Session ${k + 1}: tolerated well.`),
          },
        });
      }
    }
  }

  await seedFollowUpAndBilling(owner.id, today);

  console.log(`Seeded demo data. Login: owner@example.com / ${ownerPassword} (you'll be asked to set up 2FA).`);
  console.log(`Front desk demo: frontdesk@example.com / ${ownerPassword}`);
}

// Phase 4: payments, packages, progress ratings, follow-ups and feedback for the demo patients.
async function seedFollowUpAndBilling(ownerId: string, today: string) {
  const METHODS = ["CASH", "GCASH", "CASH", "MAYA", "CARD", "GCASH"];
  let receipt = 0;
  const pay = (patientId: string, date: string, amountPhp: number, k: number) => {
    const method = METHODS[k % METHODS.length];
    return db.payment.create({
      data: {
        patientId, date, amountPhp, method, receivedById: ownerId,
        receiptNo: `AR-${date.slice(0, 4)}-${String(++receipt).padStart(5, "0")}`,
        reference: method === "CASH" ? null : `${method === "CARD" ? "APPR" : "REF"}${100000 + Math.floor(rand() * 899999)}`,
        orNumber: k % 3 === 0 ? `${5000 + receipt}` : null,
      },
    });
  };
  const COMMENTS = [
    "Ang tagal po ng consultation pero sulit, naintindihan ko na ang lab results ko.",
    "Very accommodating ang doctor, hindi minadali ang paliwanag.",
    "Medyo matagal ang paghintay sa parking pero okay naman ang clinic.",
    "Salamat po, malinaw ang plano at alam ko ang gastos bago magsimula.",
    "Maayos po, sana may Saturday afternoon slot.",
  ];

  const patients = await db.patient.findMany({
    orderBy: { patientNo: "asc" },
    include: {
      lead: { include: { appointments: { where: { status: "ATTENDED" }, include: { consultationType: true }, orderBy: { startAt: "asc" } } } },
      plans: { include: { items: true, sessions: { orderBy: { date: "asc" } } } },
    },
  });

  for (const [i, p] of patients.entries()) {
    const appt = p.lead?.appointments[0];
    const visitDate = appt ? appt.startAt.toISOString().slice(0, 10) : p.createdAt.toISOString().slice(0, 10);

    // Consultation charge; most paid in full, some partial, a few unpaid.
    if (appt) {
      const fee = appt.consultationType.feePhp;
      await db.charge.create({ data: { patientId: p.id, date: visitDate, category: "CONSULTATION", description: appt.consultationType.name, amountPhp: fee, appointmentId: appt.id, createdById: ownerId } });
      if (i % 7 === 3) await pay(p.id, visitDate, Math.round(fee / 2), i);
      else if (i % 7 !== 5) await pay(p.id, visitDate, fee, i);
    }

    // Older unpaid balances so the receivables aging has something in each bucket.
    if (i % 6 === 2) {
      const daysAgo = [40, 75, 120][(i / 6) % 3 | 0];
      await db.charge.create({ data: { patientId: p.id, date: addDays(today, -daysAgo), category: "OTHER", description: "Laboratory processing fee", amountPhp: 1800, createdById: ownerId } });
    }

    const plan = p.plans[0];
    if (plan) {
      // Half the plan patients bought a prepaid package; the rest pay per session.
      const usePackage = i % 2 === 0;
      const pkg = usePackage
        ? await db.patientPackage.create({
            data: {
              patientId: p.id, name: `${plan.items[0].modality} 6-session package`, sessionsTotal: 6,
              pricePhp: Math.round(plan.items[0].unitPricePhp * 6 * 0.9), purchasedOn: visitDate, createdById: ownerId,
              charge: { create: { patientId: p.id, date: visitDate, category: "PACKAGE", description: `${plan.items[0].modality} 6-session package (6 sessions)`, amountPhp: Math.round(plan.items[0].unitPricePhp * 6 * 0.9), createdById: ownerId } },
            },
          })
        : null;
      if (pkg) await pay(p.id, visitDate, pkg.pricePhp, i + 1);

      for (const [k, s] of plan.sessions.entries()) {
        const item = plan.items.find((it) => it.modality === s.modality) ?? plan.items[0];
        if (pkg && s.modality === plan.items[0].modality) {
          await db.packageUse.create({ data: { packageId: pkg.id, sessionId: s.id, date: s.date } });
        } else {
          await db.charge.create({ data: { patientId: p.id, date: s.date, category: "SESSION", description: `Treatment session – ${s.modality}`, amountPhp: item.unitPricePhp, sessionId: s.id, createdById: ownerId } });
          if ((i + k) % 5 !== 0) await pay(p.id, s.date, item.unitPricePhp, i + k);
        }
        await db.progressEntry.create({
          data: { patientId: p.id, sessionId: s.id, date: s.date, score: Math.min(10, 3 + k * 2 + Math.floor(rand() * 2)), authorId: ownerId },
        });
      }
      // Baseline rating at the first visit.
      await db.progressEntry.create({ data: { patientId: p.id, date: visitDate, score: 2 + (i % 3), notesEnc: encrypt("[Demo] Baseline at first consult."), authorId: ownerId } });

      const last = plan.sessions[plan.sessions.length - 1]?.date ?? visitDate;
      const due = i % 4 === 1 ? addDays(today, -5) : addDays(last, 7); // one overdue for the demo
      await db.followUp.create({
        data: {
          patientId: p.id, dueDate: due, kind: "NEXT_SESSION", createdById: ownerId,
          ...(due < today ? { recallCount: 1, lastRecallAt: manilaToUtc(due, "10:00"), lastRecallChannel: "MESSENGER" } : {}),
        },
      });
    } else if (appt) {
      await db.followUp.create({ data: { patientId: p.id, dueDate: addDays(visitDate, 30), kind: "REASSESSMENT", note: "Review labs", createdById: ownerId } });
      await db.progressEntry.create({ data: { patientId: p.id, date: visitDate, score: 3 + (i % 4), authorId: ownerId } });
    }

    // Feedback after the first visit.
    if (appt && i % 4 !== 1) {
      const answered = i % 5 !== 4;
      const consent = answered && i % 3 === 0;
      await db.feedback.create({
        data: {
          token: `demo-feedback-${i}`, patientId: p.id, appointmentId: appt.id, sentChannel: "MESSENGER",
          expiresAt: answered ? new Date(appt.startAt.getTime() + 14 * 86_400_000) : new Date(Date.now() + 10 * 86_400_000),
          ...(answered
            ? {
                submittedAt: new Date(appt.startAt.getTime() + 26 * 3_600_000), rating: i % 7 === 2 ? 3 : i % 2 ? 4 : 5,
                commentEnc: encrypt(COMMENTS[i % COMMENTS.length]), testimonialConsent: consent,
                displayName: consent ? `${p.firstName} ${p.lastName?.[0] ?? ""}.` : null, consentVersion: consent ? "2026-10" : null,
              }
            : {}),
        },
      });
    }
  }

  // Earlier patients (before the system): inactive ones for the recall list, a stalled plan, and old balances.
  const LEGACY = [
    { first: "Lorna", last: "Dizon", lastVisitAgo: 130, owe: [{ ago: 130, amt: 2500 }], status: "COMPLETED" },
    { first: "Edgar", last: "Salazar", lastVisitAgo: 95, owe: [{ ago: 95, amt: 1800 }, { ago: 70, amt: 1200 }], status: "COMPLETED" },
    { first: "Pia", last: "Manalo", lastVisitAgo: 21, owe: [{ ago: 45, amt: 1500 }], status: "STARTED" },
  ];
  for (const [k, l] of LEGACY.entries()) {
    const p = await db.patient.create({
      data: {
        patientNo: `CM-${String(patients.length + k + 1).padStart(4, "0")}`, firstName: l.first, lastName: l.last,
        mobile: `0917${String(5550000 + k)}`, privacyConsent: true, consentAt: manilaToUtc(addDays(today, -l.lastVisitAgo - 30), "10:00"),
        createdAt: manilaToUtc(addDays(today, -l.lastVisitAgo - 30), "10:00"),
      },
    });
    const plan = await db.treatmentPlan.create({
      data: {
        patientId: p.id, title: "Plan 1", status: l.status, authorId: ownerId, startedAt: manilaToUtc(addDays(today, -l.lastVisitAgo - 21), "10:00"),
        items: { create: [{ modality: "Acupuncture", sessions: 4, unitPricePhp: 1800, sortOrder: 0 }] },
        consent: { create: { consentDate: addDays(today, -l.lastVisitAgo - 21), explainedById: ownerId, explainedByName: "Demo Doctor", patientAcknowledged: true, acknowledgement: "Explained and agreed." } },
      },
    });
    for (let n = 3; n >= 0; n--) {
      const date = addDays(today, -l.lastVisitAgo - n * 7);
      const sess = await db.treatmentSession.create({ data: { planId: plan.id, patientId: p.id, date, modality: "Acupuncture", authorId: ownerId } });
      await db.progressEntry.create({ data: { patientId: p.id, sessionId: sess.id, date, score: 4 + (3 - n), authorId: ownerId } });
    }
    for (const o of l.owe) {
      await db.charge.create({ data: { patientId: p.id, date: addDays(today, -o.ago), category: "SESSION", description: "Treatment session – Acupuncture", amountPhp: o.amt, createdById: ownerId } });
    }
  }

  // A few walk-in payments today so Daily collections has something to show.
  const recent = patients.slice(-3);
  for (const [k, p] of recent.entries()) {
    await db.charge.create({ data: { patientId: p.id, date: today, category: "OTHER", description: "Supplements (clinic-dispensed)", amountPhp: 950 + k * 300, createdById: ownerId } });
    await pay(p.id, today, 950 + k * 300, k + 1);
  }
}

main().finally(() => db.$disconnect());
