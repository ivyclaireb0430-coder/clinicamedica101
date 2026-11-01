# SOP 1: Inquiries at Messenger

**Layunin:** Masagot ang bawat inquiry sa loob ng **1 oras** sa clinic hours, at ma-book ang consult.

## Paano gumagana ang bot

Kapag nag-message ang tao sa Facebook Page, sasagot ang bot ayon sa saved scripts: presyo, oras, lokasyon, at booking.
Puwedeng mag-book ang tao mismo sa Messenger (pipili ng consult type, oras, pangalan, at mobile).
Kapag may tanong na hindi kaya ng bot, o medikal na tanong, ipapasa ito sa doktor at lalabas sa **Inbox**.

## Araw-araw (umaga, tanghali, hapon)

1. Buksan ang **Inbox**. Unahin ang may markang *needs doctor*.
2. Para sumagot nang personal: pindutin ang **Pause auto-replies**, isulat ang sagot, at i-send.
   Kapag sumagot ka mula sa Facebook Page inbox mismo, kusang magpa-pause ang bot.
3. Kapag tapos na: **Mark handled**. Kung gusto mong bumalik ang bot: **Resume auto-replies**.
4. Para sa medikal na tanong ("anong gamot", "normal ba ito"): huwag sagutin sa chat. Gamitin ang script na
   nag-iimbita sa consult, o ipasa sa doktor.

## Inquiry na hindi galing sa Messenger (tawag, walk-in, referral, radyo)

1. **Leads → + New** (o **Add new inquiry** sa Calendar).
2. Ilagay ang pangalan, mobile, **source** (hal. Radio, Referral, Walk-in), at campaign kung meron.
3. Itanong at i-record ang privacy consent bago kunin ang health concern.

## Pipeline: ilipat ang stage

Sa lead record, **Move in pipeline → Update stage**:

`New inquiry → Replied → Fee/schedule explained → Booked → Attended → Treatment plan accepted → In follow-up`

Kusang lumilipat ang stage kapag nag-book o nag-attend. Gamitin ang **Inactive/Lost** at pumili ng *lost reason*
kapag hindi na tumuloy. Mahalaga ito sa dashboard para malaman kung bakit nawawala ang leads.

Ang lead na walang booking pagkalipas ng 3 araw ay lalabas sa listahang *needs follow-up*. Mag-message gamit ang saved script.
