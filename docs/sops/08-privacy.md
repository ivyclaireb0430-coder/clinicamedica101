# SOP 8: Privacy at data requests (Owner / DPO)

Batay sa Data Privacy Act (RA 10173). Detalye: **More → Privacy & data**.

## Kapag may humingi ng kopya ng data niya (access request)

1. **Kumpirmahin na siya talaga:** dapat galing ang request sa nakarehistrong mobile o email, o personal na may ID.
2. Buksan ang record (Patients o Leads). Sa ibaba ng **Overview**, sa *Privacy requests* box: **Download all their data (JSON)**.
3. Ipadala nang ligtas (hal. naka-password na file, at ibang channel para sa password). Sagutin sa loob ng **30 araw**.

## Kapag hiniling na burahin (erasure request)

1. Kumpirmahin ang pagkakakilanlan, tulad sa itaas.
2. Sa *Privacy requests* box: **Erase this person…**, ilagay ang dahilan, i-type ang patient number (o `ERASE` para sa lead), at **Erase permanently**.
3. Ano ang mangyayari: mabubura ang health records, files, at chat history. Kung may bayad na naitala, mananatili ang
   resibo para sa BIR, pero wala nang pangalan. Naitatala ito sa audit log.
4. **Hindi na ito maibabalik.** Sabihan ang tao kapag tapos na.

## Retention (tuwing 3 buwan)

**More → Privacy & data → Retention policy.** Default: pasyente 10 taon mula sa huling bisita, at lead na hindi
naging pasyente 24 buwan. Nakalista ang mga lampas na. I-review ang bawat isa, at burahin kung wala nang dahilan
para itago. Walang kusang binubura ang system.

## Taun-taon

- [ ] I-review ang **More → Users & roles**: i-deactivate ang hindi na nagtatrabaho.
- [ ] Silipin ang **Audit log** para sa kakaibang pag-view.
- [ ] Subukan ang restore ng backup (DEPLOY.md).
- [ ] Basahin ulit ang [BREACH-RESPONSE.md](../BREACH-RESPONSE.md).
