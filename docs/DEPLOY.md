# Paano i-deploy ang Clinica Medica 101 system (production)

Gabay ito para ilagay ang system sa sarili nating server sa Singapore, at gawing
**https://app.clinicamedica101.org** ang address nito. Isang beses lang itong gagawin. Mga 45–60 minuto.

**Gastos:** DigitalOcean 2 GB server ≈ **US$12/buwan**. Kung bubuksan ang automatic backups ng DigitalOcean,
dagdag na **≈ US$2.40/buwan** (recommended). Libre ang HTTPS certificate (Let's Encrypt, automatic).

> **Mahalaga:** Huwag i-paste kahit kanino (pati sa chat) ang laman ng `/etc/clinic/clinic.env`.
> Nandiyan ang mga susi ng system.

---

## Bago magsimula

- [ ] Naka-merge na ang Phase 6 sa `main` (doon kinukuha ng server ang code).
- [ ] May GoDaddy login ka para sa **clinicamedica101.org**.
- [ ] May password manager ka (hal. Bitwarden, 1Password), o papel at sobre na itatago sa kandado.
- [ ] Sa Windows: gagamit tayo ng **PowerShell**. Sa Mac: **Terminal**.
- [ ] (Recommended) Gawing **Private** ang GitHub repo. Tingnan ang [Kung private ang repo](#kung-private-ang-repo).

---

## Step 1. Gumawa ng SSH key sa laptop mo

Ito ang "susi" para makapasok ka sa server. Mas ligtas ito kaysa password.

Sa PowerShell o Terminal:

```bash
ssh-keygen -t ed25519 -C "clinic-server"
```

Pindutin lang ang Enter sa tanong kung saan ise-save. Maglagay ng passphrase na maaalala mo.
Pagkatapos, ipakita ang public key:

```bash
cat ~/.ssh/id_ed25519.pub
```

Kopyahin ang buong linya (nagsisimula sa `ssh-ed25519`). Gagamitin ito sa Step 2.

## Step 2. Gumawa ng server sa DigitalOcean

1. Mag-sign up sa https://www.digitalocean.com at maglagay ng card.
2. **Create → Droplets**.
3. **Region:** Singapore (SGP1).
4. **Image:** Ubuntu **24.04 (LTS) x64**.
5. **Size:** Basic → Regular → **2 GB RAM / 1 CPU / 50 GB** (≈ $12/buwan).
6. **Authentication:** SSH Key → **New SSH Key** → i-paste ang key mula sa Step 1.
7. **Backups:** i-on (weekly) — recommended.
8. **Hostname:** `clinic-app`.
9. **Create Droplet**. Pagkalipas ng isang minuto, makikita ang **IP address** (hal. `159.89.200.10`). Kopyahin ito.

## Step 3. I-point ang domain sa server (GoDaddy DNS)

1. Mag-login sa https://dcc.godaddy.com → **My Products** → sa tabi ng *clinicamedica101.org*, **DNS**.
2. **Add New Record**:
   - **Type:** `A`
   - **Name:** `app`
   - **Value:** ang IP ng droplet (mula Step 2)
   - **TTL:** 1/2 Hour (o Default)
3. **Save**.

Hindi nito gagalawin ang website o email mo sa `clinicamedica101.org`. Ang `app.` lang ang papunta sa server.

I-check kung gumagana na (minsan 5–30 minuto bago kumalat):

```bash
nslookup app.clinicamedica101.org
```

Dapat lumabas ang IP ng droplet.

## Step 4. Pumasok sa server at i-install ang system

```bash
ssh root@IP_NG_DROPLET
```

(Sa unang beses, i-type ang `yes`.) Nasa loob ka na ng server. I-paste ito:

```bash
curl -fsSL https://raw.githubusercontent.com/ivyclaireb0430-coder/clinicamedica101/main/deploy/setup-server.sh -o setup-server.sh
bash setup-server.sh app.clinicamedica101.org
```

Mga 10–15 minuto ito. Ginagawa ng script:

- Ina-update ang Ubuntu at nag-i-install ng Node.js 22, PostgreSQL at Caddy (para sa HTTPS).
- Ginagawa ang database at **bagong random na mga susi** (`ENCRYPTION_KEY`, `AUTH_SECRET`, `BACKUP_PASSPHRASE`, atbp.) sa `/etc/clinic/clinic.env`.
- Dina-download at bini-build ang app, at pinapatakbo bilang service na kusang nagre-restart.
- Reminders bawat 15 minuto, Google sync bawat 10 minuto, at **encrypted backup araw-araw, 2:00 AM**.
- Firewall (bukas lang ang SSH, 80, 443), fail2ban (hinaharang ang paulit-ulit na maling login), at automatic security updates.

Sa dulo, ipapakita nito ang "Next steps".

## Step 5. I-save ang mga susi (HUWAG LAKTAWAN)

```bash
sudo grep -E 'ENCRYPTION_KEY|BACKUP_PASSPHRASE' /etc/clinic/clinic.env
```

Kopyahin ang dalawang linya sa password manager (o isulat at itago sa kandado).

- **ENCRYPTION_KEY:** kung mawala ito, hindi na mababasa ang mga naka-encrypt na health notes.
- **BACKUP_PASSPHRASE:** kung mawala ito, hindi na mabubuksan ang mga backup.

## Step 6. Gawin ang login mo

```bash
sudo bash /opt/clinic/deploy/create-owner.sh ikaw@gmail.com "Dr. Pangalan Mo"
```

Ipapakita nito ang **temporary password** nang isang beses lang. Buksan ang
**https://app.clinicamedica101.org**, mag-login, at i-set up ang 2FA gamit ang Google Authenticator o Authy.
Palitan ang password sa **More → Users & roles → Change my password**.

Kung "not secure" o error ang lumabas: hintayin pa ang DNS (Step 3), tapos `sudo systemctl restart caddy`.

## Step 7. Ikonekta ang Google, Messenger at SMS

Lahat ng ito ay inilalagay sa server lang:

```bash
sudo nano /etc/clinic/clinic.env      # i-edit, Ctrl+O para i-save, Ctrl+X para lumabas
sudo systemctl restart clinic
```

### Google Calendar + Gmail

1. https://console.cloud.google.com → gumawa ng project na "Clinica Medica 101".
2. **APIs & Services → Library:** i-enable ang **Google Calendar API** at **Gmail API**.
3. **OAuth consent screen:** External, app name "Clinica Medica 101", ilagay ang email mo bilang test user.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   - **Authorized redirect URI:** `https://app.clinicamedica101.org/api/google/callback`
5. Ilagay sa `clinic.env` ang `GOOGLE_CLIENT_ID` at `GOOGLE_CLIENT_SECRET`, tapos i-restart.
6. Sa app: **More → Google Calendar → Connect**. Gamitin ang Gmail ng clinic.

### Facebook Messenger

1. Sa Meta app (developers.facebook.com) → **Messenger → Settings**.
2. **Webhook callback URL:** `https://app.clinicamedica101.org/api/webhooks/messenger`
3. **Verify token:** ito ang `META_VERIFY_TOKEN` na ginawa na ng setup. Makikita ito gamit ang
   `sudo grep META_VERIFY_TOKEN /etc/clinic/clinic.env`.
4. I-subscribe ang Page sa: `messages`, `messaging_postbacks`, `messaging_referrals`, `message_echoes`.
5. Ilagay sa `clinic.env`: `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`,
   at `FB_PAGE_USERNAME` (hal. `clinicamedica101`). I-restart.

### SMS (Semaphore, may bayad bawat text, optional)

Ilagay ang `SEMAPHORE_API_KEY` at `SEMAPHORE_SENDER_NAME` (kapag approved na ang sender name), tapos i-restart.
Kapag walang laman, naka-off ang SMS.

## Step 8. Off-site backup (recommended)

Nasa server mismo ang daily backup (`/var/backups/clinic`, 30 araw). Para may kopya sa labas kung masira
ang server, ikonekta ang Google Drive gamit ang rclone:

```bash
sudo apt-get install -y rclone
sudo -u clinic rclone config      # n → name: gdrive → storage: drive → sundan ang prompts (headless: "n" sa auto config)
```

Tapos sa `clinic.env`: `RCLONE_REMOTE="gdrive:clinic-backups"`. Encrypted na ang file bago ipadala,
kaya hindi ito mababasa ng Google nang walang `BACKUP_PASSPHRASE`.

Subukan: `sudo -u clinic bash /opt/clinic/deploy/backup.sh`

---

## Araw-araw na pag-aalaga

| Gawain | Command (sa server) |
| --- | --- |
| I-update sa bagong version (pagkatapos ng merge) | `sudo bash /opt/clinic/deploy/update.sh` — may backup muna, tapos build at restart |
| Tingnan kung buhay | `curl -s https://app.clinicamedica101.org/api/health` → `{"ok":true}` |
| Tingnan ang logs | `sudo journalctl -u clinic -n 100` |
| Manual backup | `sudo -u clinic bash /opt/clinic/deploy/backup.sh` |
| Listahan ng backups | `ls -lh /var/backups/clinic` |
| Restart ng app | `sudo systemctl restart clinic` |

### I-restore mula sa backup

**Babala:** papalitan nito ang lahat ng kasalukuyang data ng laman ng backup.

```bash
sudo bash /opt/clinic/deploy/restore.sh /var/backups/clinic/clinic-20261101-0200.tar.enc
```

I-type ang `RESTORE` para ituloy. Kung sa bagong server ire-restore, patakbuhin muna ang Step 4, tapos ilagay ang
lumang `ENCRYPTION_KEY` at `BACKUP_PASSPHRASE` sa bagong `clinic.env` **bago** mag-restore.

Subukan ang restore kahit isang beses bawat 3 buwan (sa test server), para sigurado tayong gumagana ang backups.

---

## Kung private ang repo

Kapag private ang GitHub repo, kailangan ng server ng sariling "deploy key" para ma-download ang code:

1. Patakbuhin ang Step 4. Titigil ito sa "App code" dahil wala pang access. Normal iyon.
2. Gumawa ng key para sa app user:
   ```bash
   sudo -u clinic mkdir -p -m 700 /home/clinic/.ssh
   sudo -u clinic ssh-keygen -t ed25519 -N "" -f /home/clinic/.ssh/id_ed25519
   sudo cat /home/clinic/.ssh/id_ed25519.pub
   ```
3. Sa GitHub: repo → **Settings → Deploy keys → Add deploy key**. I-paste ito, at **huwag** i-check ang write access.
4. I-download ang setup script mula sa GitHub (Code → Download, o kopyahin ang file), tapos patakbuhin ulit:
   ```bash
   sudo -u clinic ssh -o StrictHostKeyChecking=accept-new -T git@github.com   # OK lang ang "does not provide shell access"
   REPO_URL=git@github.com:ivyclaireb0430-coder/clinicamedica101.git bash setup-server.sh app.clinicamedica101.org
   ```
   Ligtas itong ulitin: hindi papalitan ang mga susi o data.

## Kung may problema

- **Hindi bumubukas ang site:** `sudo systemctl status clinic caddy`. Kung "failed" ang clinic, tingnan ang
  `sudo journalctl -u clinic -n 50`. Kadalasan ay may maling setting sa `clinic.env`, at sasabihin ng log kung alin.
- **Hindi dumarating ang Messenger replies:** tingnan sa Meta kung "verified" ang webhook, at kung tama ang Page token.
- **Na-lock ka:** 15 minuto bago ka makasubok ulit. Kung nawala ang 2FA phone, patakbuhin ulit ang
  `create-owner.sh` gamit ang ibang email, tapos i-deactivate ang luma sa **More → Users & roles**.
- **Data breach o nawalang laptop/phone:** sundin ang [BREACH-RESPONSE.md](BREACH-RESPONSE.md).
