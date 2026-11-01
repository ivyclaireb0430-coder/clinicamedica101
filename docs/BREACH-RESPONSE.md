# Kapag may data breach (Data Privacy Act, RA 10173)

Ang **personal data breach** ay anumang pangyayari kung saan nakita, nakuha, nabago, o nawala ang data ng
pasyente o lead nang walang pahintulot. Mga halimbawa: nawalang phone o laptop na naka-login, may nakakuha ng
password, maling taong napadalhan ng resulta, na-hack na server o Facebook Page.

> Praktikal na gabay ito, hindi legal advice. Ipa-confirm sa DPO ang kasalukuyang patakaran ng NPC
> (NPC Circular 16-03 at mga sumunod dito).

**DPO (Data Protection Officer):** ______________________ · Mobile: ______________
**NPC:** https://privacy.gov.ph · complaints@privacy.gov.ph · breach reporting: https://privacy.gov.ph/data-breach-notification/

---

## 1. Sa loob ng 1 oras: pigilan

- [ ] **Nawalang phone o laptop:** mula sa ibang device, mag-login, pumunta sa **More → Users & roles**, at
      i-deactivate ang account na naka-login doon. Palitan ang password ng sarili mong account.
- [ ] **Na-leak na password:** palitan agad. Kung Owner account ito, gumawa ng bagong owner (tingnan ang DEPLOY.md)
      at i-deactivate ang luma para mapalitan din ang 2FA.
- [ ] **Na-leak na Meta o Google token:** sa Meta, i-generate ulit ang Page access token. Sa Google, i-revoke ang
      access sa https://myaccount.google.com/permissions, tapos i-Connect ulit sa **More → Google Calendar**.
      Ilagay ang bagong token sa `/etc/clinic/clinic.env` at i-restart.
- [ ] **Posibleng na-hack ang server:** i-off muna ang droplet sa DigitalOcean (**Power → Turn off**). Huwag burahin
      dahil kailangan ito para malaman ang nangyari.

## 2. Sa araw ding iyon: itala

Gumawa ng incident report (puwedeng Google Doc o papel) na may:

- [ ] Kailan nangyari at kailan nalaman
- [ ] Anong data ang naapektuhan (pangalan, mobile, health notes, resulta, bayad)
- [ ] Ilang tao, at sinu-sino (listahan)
- [ ] Paano nangyari, at ano na ang ginawa
- [ ] I-export ang audit log: **More → Audit log → Export CSV**. Tingnan kung sino ang nag-view o nag-edit, at kailan.

## 3. Sa araw ding iyon: kailangan bang i-report?

Kailangang i-report sa NPC **at** sabihan ang mga pasyente kung **lahat** ng ito ay totoo:

1. **Sensitive personal information** ang sangkot. Kasama rito ang health data (concern, assessment, plan, progress
   notes, lab results), o data na puwedeng gamitin sa identity fraud.
2. May dahilan para maniwalang **nakuha ito ng taong walang pahintulot**.
3. Puwede itong magdulot ng **seryosong pinsala** sa pasyente (hiya, diskriminasyon, panloloko).

Kung naka-encrypt ang data at hindi nakuha ang susi (`ENCRYPTION_KEY`), kadalasan hindi ito notifiable. Pero itala pa rin.
Kapag hindi sigurado, ituring na notifiable at kausapin ang DPO.

## 4. Sa loob ng 72 oras: mag-report (kung notifiable)

- [ ] **NPC:** ipadala ang report sa NPC (online form o email). Isama ang: ano ang nangyari, anong data, ilang tao,
      ano ang ginawa ninyo, at sino ang contact person (DPO).
- [ ] **Mga pasyente:** sabihan sila nang direkta (tawag, text, o email; huwag sa public post). Sabihin kung ano
      ang nangyari, anong data nila ang sangkot, ano ang ginawa ng clinic, ano ang puwede nilang gawin, at sino ang
      puwede nilang kontakin.

Halimbawang mensahe sa pasyente:

> Magandang araw po, [pangalan]. Ito po ang Clinica Medica 101. Noong [petsa], [maikling paliwanag, hal. nawala ang
> isang phone na may access sa aming system]. Ang posibleng nakita ay ang inyong [data]. Agad po naming
> [ginawa: hal. na-lock ang account at napalitan ang mga password]. Wala pa po kaming nakikitang ebidensya na nagamit
> ito, pero mag-ingat po sa mga tawag o text na nagsasabing galing sa clinic at humihingi ng bayad o OTP. Para sa
> tanong, tawagan po si [DPO] sa [mobile]. Humihingi po kami ng paumanhin.

## 5. Pagkatapos

- [ ] Ayusin ang dahilan (hal. i-require ang screen lock sa lahat ng phone, alisin ang shared accounts).
- [ ] Kung may nawala o nabago na data: i-restore mula sa backup (**DEPLOY.md → I-restore mula sa backup**).
- [ ] Itago ang incident report kahit hindi notifiable. Puwede itong hingin ng NPC.
- [ ] Taun-taon, kahit walang breach: i-review ang users, palitan ang mga password, at subukan ang restore.
