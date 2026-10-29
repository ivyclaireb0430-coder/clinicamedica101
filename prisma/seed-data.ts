// Default Taglish Messenger scripts. Placeholders: {first_name} {date} {time}. Text in [brackets] is for the clinic to fill in.
export const SCRIPTS = [
  {
    key: "first_reply", category: "Unang reply", title: "Unang reply (bagong inquiry)",
    body: "Hi {first_name}! Salamat sa pag-message sa Clinica Medica 101. 😊 Para matulungan namin kayo nang maayos, ano po ang pangunahing concern ninyo? Bago po kayo magbahagi ng health details, paki-basa po ang aming privacy notice: [link]. Puwede rin po kayong pumili sa mga button sa ibaba.",
  },
  {
    key: "approach", category: "Paliwanag", title: "Paano kami mag-assess (approach ng clinic)",
    body: "Sa Clinica Medica 101, hindi lang po namin tinitingnan ang sintomas. Sa unang consultation, maglalaan ang doktor ng sapat na oras para alamin ang inyong history, lifestyle, at posibleng pinagmumulan ng problema. Pagkatapos, ipapaliwanag niya ang findings at gagawa kayo ng plano nang magkasama, ayon sa kung ano ang angkop sa inyo.",
  },
  {
    key: "fee", category: "Presyo", title: "Consultation fee at kasama dito",
    body: "Ang consultation fee po ay ₱[fee]. Kasama na po dito ang mahabang one-on-one na assessment sa doktor (mga [minutes] minuto), pag-review ng inyong past labs o records, at paliwanag ng findings at mga susunod na hakbang. Kung may irerekomendang tests o treatment, ipapaliwanag muna ang gastos bago kayo magdesisyon.",
  },
  {
    key: "first_consult", category: "Paliwanag", title: "Ano ang mangyayari sa unang consult",
    body: "Sa unang consult po: (1) kukunin ang inyong medical history at kasalukuyang gamot, (2) pag-uusapan ang inyong concern nang detalyado, (3) physical exam kung kailangan, (4) ipapaliwanag ng doktor ang kanyang assessment at mga options. Dalhin po ang mga lumang lab results, reseta, o gamot na iniinom ninyo kung meron.",
  },
  {
    key: "schedule", category: "Schedule", title: "Available schedule",
    body: "Hi {first_name}! Ang clinic hours po namin ay [days and hours]. May bakante po kami sa {date}, {time}. Gusto n'yo po bang i-book ko na?",
  },
  {
    key: "location", category: "Location", title: "Location at parking",
    body: "Nasa Centuria Medical Makati po kami, Kalayaan Ave. cor. Salamanca St., Makati City, [Room/Unit]. May parking po sa building (bayad per hour). Kung mag-commute, malapit po ito sa Kalayaan Ave at Makati Ave.",
  },
  {
    key: "price_objection", category: "Presyo", title: "Kapag nag-aalala sa presyo",
    body: "Naiintindihan ko po, {first_name}, mahalaga talaga ang budget. Ang layunin po ng unang consultation ay maintindihan nang mabuti ang inyong kondisyon para hindi kayo magpalipat-lipat ng gamot o doktor. Walang obligasyon na tumuloy sa anumang treatment; kayo pa rin po ang magdedesisyon pagkatapos ipaliwanag ng doktor ang options at gastos.",
  },
  {
    key: "booking_confirm", category: "Booking", title: "Booking confirmation",
    body: "Confirmed na po, {first_name}! Ang inyong consultation ay sa {date}, {time} sa Clinica Medica 101, Centuria Medical Makati. Paki-reply ng OK para i-confirm, o RESCHED kung kailangang palitan ang oras.",
  },
  {
    key: "reminder_day_before", category: "Booking", title: "Reminder (1 araw bago)",
    body: "Hi {first_name}! Paalala lang po: may consultation kayo bukas, {date}, {time}. Paki-reply ng OK para i-confirm, o RESCHED kung kailangang palitan.",
  },
  {
    key: "reminder_day_of", category: "Booking", title: "Reminder (sa mismong araw)",
    body: "Good morning {first_name}! Paalala po: ang inyong consultation ay ngayong araw, {time}, sa Clinica Medica 101, Centuria Medical Makati. Dalhin po ang mga lumang lab results o gamot kung meron. Kita-kits po!",
  },
  {
    key: "no_show_rebook", category: "Follow-up", title: "Na-miss ang appointment (re-book)",
    body: "Hi {first_name}, napansin po naming hindi kayo nakarating sa appointment ninyo. Sana po ay okay kayo. Gusto n'yo po bang mag-book ng bagong schedule? Sabihin lang po kung anong araw at oras ang pinaka-convenient.",
  },
  {
    key: "follow_up_nudge", category: "Follow-up", title: "Follow-up sa hindi pa nagbo-book",
    body: "Hi {first_name}! Kumusta na po? Nag-message lang po ako para i-check kung may tanong pa kayo tungkol sa consultation. Nandito lang po kami kung handa na kayong mag-schedule.",
  },
  {
    key: "doctor_handoff", category: "Unang reply", title: "Ipapasa sa doktor (medical na tanong)",
    body: "Salamat po sa pagbahagi, {first_name}. Para masagot ito nang tama at ligtas, ipapasa ko po ito sa doktor at siya mismo ang sasagot. Kung emergency po ito (hal. hirap huminga, matinding pananakit ng dibdib), pumunta po agad sa pinakamalapit na ER.",
  },
];
