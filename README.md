# MVNE Client Ticket Portal

A static, no-backend web form clients use to log a support ticket (with
MSISDN and ICCID) directly into Zammad at `https://support.mvne.co.za`.

It works entirely client-side using Zammad's real public form API
(`POST /api/v1/form_config` then `POST /api/v1/form_submit`) — the same
mechanism behind Zammad's "Form" channel widget, just with our own HTML/CSS
instead of Zammad's default embeddable widget. There is no server and no API
token shipped to the browser — security comes from a short-lived
fingerprint/token handshake plus Zammad's own spam protection, not from a
CORS domain whitelist (Zammad sends `Access-Control-Allow-Origin: *` on this
endpoint by design, since it's meant to be embeddable on any site).

## Files

| File | Purpose |
|------|---------|
| `index.html` | The generic ticket form markup. |
| `afgri-connect.html` | AFGRI Connect branded version of the same form (see below). |
| `canal-connect.html` | Canal+ / Multichoice branded version of the same form (see below). |
| `assets/style.css` | Shared styling (structure, form controls, scanner modal). |
| `assets/style-afgri.css` | AFGRI color/branding overrides, loaded only by `afgri-connect.html`. |
| `assets/style-canal.css` | Canal+ color/branding overrides, loaded only by `canal-connect.html`. |
| `assets/config.js` | **Edit this** — Zammad URL, issue categories, priorities (used by `index.html`). |
| `assets/config-afgri.js` | Same shape as `config.js`, used by `afgri-connect.html`. |
| `assets/config-canal.js` | Same shape as `config.js`, used by `canal-connect.html` — also the one with `extraFields` configured (see below). |
| `assets/script.js` | Validation + submission logic (Zammad `form_config`/`form_submit` handshake) — shared by all pages, unmodified per client. |

### AFGRI Connect branded page

`afgri-connect.html` is a copy of the same form with AFGRI's own colors
(`#1d388c` blue / `#0db14b` green — pulled from afgri.co.za's live Tailwind
theme tokens, not guessed) and a hero header using their own "AFGRI Connect"
copy. It intentionally shares `assets/script.js` unchanged — only the HTML
shell, `style-afgri.css`, and `config-afgri.js` differ — so any future fix or
feature (like the barcode scanner) automatically applies to both pages.

Two things worth knowing if you maintain this:

- AFGRI's site is Next.js and doesn't expose a directly-linkable logo file,
  and their CDN 403s on hotlinked/external requests to their icon assets
  (`/media/.../connect.svg` returned `403` when fetched from outside their
  site) — so the hero icon here is a small self-contained inline SVG instead
  of their actual logo. If you get an official AFGRI logo file from them,
  swap it in rather than hotlinking their CDN.
- `config-afgri.js` is currently an exact copy of `config.js`. If AFGRI needs
  different issue categories/priorities from the generic portal later, edit
  `config-afgri.js` independently — they're deliberately not shared so one
  client's changes can't affect another's page.

To add another client-branded page later, copy `afgri-connect.html` +
`config-afgri.js` as a template, swap the palette in a new `style-<client>.css`
override file, and leave `script.js` alone.

### Canal+ / Multichoice branded page

`canal-connect.html` follows the exact same pattern as the AFGRI page, using
Canal+'s own colors (`#03151C` near-black / white — Canal+ itself has had no
official public hex codes since their 1995 black-and-white identity, so
these are taken from the myCANAL streaming platform's published theme
instead, which is the closest confirmed source). Zammad tracks Multichoice
and Canal-plus (plus their `Clone:` variants) as one merged client called
"Canal+" for reporting purposes (see `mvne_superset/runbook.md` — "Canal+
backfill"), so that's the name used here too rather than the separate
underlying org names.

This page is also where the **extra follow-up fields** feature (below) is
actually configured — `config-canal.js` isn't just a copy of the generic
config like `config-afgri.js` currently is.

It also has two extra always-required fields not on the other pages -
**Financial account number** and **Subscriber ID** - since every Canal+
ticket needs the account identified regardless of issue type. These are
hardcoded into `canal-connect.html` (`#financial_account_number` /
`#subscriber_id`) and feature-detected in `script.js` (`form.financial_account_number` /
`form.subscriber_id` - only validated/submitted when the element exists on
the page), so the generic and AFGRI pages are unaffected. Same
`form_allowed_params` rule as `msisdn`/`iccid` applies if you want these to
land as real ticket columns rather than just body text:
`Setting.set('form_allowed_params', [..., 'financial_account_number', 'subscriber_id'])`
(after creating matching Object Manager attributes).

### g) Extra follow-up fields per issue type

Some issue types need specific information MVNE would otherwise have to
chase up separately with a follow-up email/call — e.g. a SIM Swap ticket is
incomplete without the replacement SIM's ICCID. Rather than hardcoding this
per page, any category in `ISSUE_CATEGORIES` (`assets/config-canal.js`) can
declare an `extraFields` array:

```js
{
  category: "SIM Swap",
  subcategories: [...],
  extraFields: [
    {
      id: "new_sim_iccid",       // used as the FormData field name + Zammad param name
      label: "New SIM ICCID",    // shown as the field label and in the ticket body
      type: "iccid",             // "iccid" gets the barcode-scan button + 10-digit auto-prefix; "text" is a plain input
      placeholder: "ICCID of the replacement SIM",
      hint: "Optional helper text shown under the field",
      required: true,
    },
  ],
},
```

When a client picks that category, the extra field(s) render automatically
right under "Issue detail", get validated the same way as any other
required field, and are included both in the ticket body text (always) and
as a same-named `FormData` field on submit (lands as a real ticket column
only if allow-listed via `form_allowed_params`, same as `msisdn`/`iccid`
above — same one-time Object Manager + Rails console steps apply to any new
`id` you add here).

As of 2026-07-17, the Canal+ page has `extraFields` on: **SIM Swap**
(New SIM ICCID), **Data** (Voucher ID, on every subcategory), and
**Tariff migration** (Tariff package). The generic and AFGRI pages don't have
any `extraFields` set, so nothing extra renders for them; add more as you
identify which other issue types need it.

`extraFields` can be declared at two levels, and both apply together when
present:

- **On the category** — shows for every subcategory under it (e.g. Data's
  "Voucher ID" shows regardless of which Data subcategory is picked).
- **On one subcategory** — make that subcategory entry `{ name, extraFields }`
  instead of a plain string, and its fields only show when that specific
  issue detail is picked. Used for Data > "Data transfer", which additionally
  needs Old MSISDN + New MSISDN on top of the category-wide Voucher ID (see
  `assets/config-canal.js`).

## 1. One-time Zammad admin setup (required before this will work at all)

You need admin access to `https://support.mvne.co.za`.

### a) Enable the Form channel and pick a group

**Manage > Channels > Form** → switch it on, and select the group new
tickets from this form should land in. This is required — as of writing,
`POST /api/v1/form_config` on your instance returns `403 Forbidden`, which
means the channel is currently **disabled**. Nothing else below will work
until this is switched on.

The target group is controlled entirely by this admin setting
(`form_ticket_create_group_id` under the hood) — the form's JavaScript
cannot choose or override the group per submission.

### b) Add MSISDN / ICCID as real ticket fields (optional but recommended)

Zammad's form endpoint only ever writes `title` plus whatever attribute
names are listed in a setting called `form_allowed_params` — there is no
admin UI toggle for this list, it has to be set via the Rails console:

1. **Manage > Object Manager > Ticket > New attribute** — create `msisdn`
   (Data type: Text), then repeat for `iccid`. Zammad restarts background
   workers automatically after saving.
2. Open a Rails console on the Zammad server (e.g. `zammad run rails console`
   for a package install, or `docker compose exec zammad-railsserver rails
   console` for a Docker install — check which applies to your setup) and
   run:
   ```ruby
   Setting.set('form_allowed_params', ['msisdn', 'iccid', 'issue', 'issue_detail'])
   ```
   `issue` is already a real column (the same one the Superset reports at
   `mvne_superset/` build on), so no object-manager step is needed for it.
   `issue_detail` (the sub-category, see below) would need its own object
   attribute created first, same as `msisdn`/`iccid`, if you want it
   allow-listed too — otherwise it's still visible to agents in the ticket
   title/body regardless.

Clients can report either one or multiple affected numbers (a radio choice
in the form adds/removes extra MSISDN/ICCID row pairs, capped at
`MAX_AFFECTED_NUMBERS` in `config.js`). Since `msisdn`/`iccid` are plain text
Ticket attributes, not arrays, multiple numbers are sent as a single
comma-joined string (e.g. `msisdn: "0821234567, 0837654321"`) — if you'd
rather have one ticket per affected number instead of one ticket listing
several, that needs a different flow (e.g. submitting once per number) and
isn't what this version does.

**If you skip the `form_allowed_params` step**, the form still works
end-to-end: MSISDN(s), ICCID(s), company name and requested priority are
always appended to the ticket body text (`script.js` does this
unconditionally), so nothing is lost — they just won't be their own
queryable ticket columns.

### c) Check spam protection settings

**Manage > Channels > Form** also has a spam-protection section (honeypot /
CAPTCHA provider such as ALTCHA, Turnstile, or hCaptcha). If a CAPTCHA
provider is turned on there, submissions from this custom form will fail
with a "your submission could not be verified" error, because this form
doesn't embed that provider's challenge widget. For an internal client-facing
form like this, the simplest fix is to leave spam protection off (or
honeypot-only); ask if you need the CAPTCHA path added instead.

### d) Keep the issue-type list consistent

Whether or not you complete step (b), keep `ISSUE_CATEGORIES` in
`assets/config.js` as the single source of truth for category names, and add
new ones there rather than letting anything free-type a category — the
Superset reporting SQL normalizes casing but still fragments on genuinely
different strings (see `mvne_superset/runbook.md` — "Case-duplicated issue
types").

`ISSUE_CATEGORIES` is a list of `{ category, subcategories }` objects — the
form shows "Issue type" (the category) first, then populates a second
"Issue detail" dropdown with that category's `subcategories` once one is
picked. Only `category` feeds the existing `tickets.issue` column; the
chosen subcategory is sent as `issue_detail` and always appears in the
ticket title (`Category — Subcategory`) and body, landing as a real ticket
column too only if you allow-list `issue_detail` as described above.

### e) Auto-tag tickets by issue detail (sub-category)

The public form endpoint this site submits to has no way to set Zammad
tags directly — tags aren't a Ticket column, they're a separate model only
settable via `tag_add`/`tag_update`, which that endpoint never calls (see
`app/controllers/form_controller.rb` in Zammad's source). So this has to be
done with **Triggers** instead, which only support a fixed tag value per
trigger (not a value pulled dynamically from the field) — one trigger per
sub-category:

**Manage > Triggers > New Trigger**, for each row below:
Condition `Ticket → Issue Detail → is → <Issue detail>` → Action `Add Tag
→ <Tag>`.

This requires `issue_detail` to already be allow-listed per step (b) above
(object attribute created + added to `form_allowed_params`), otherwise
"Issue Detail" won't appear as a condition option at all.

| Category | Issue detail | Tag |
|---|---|---|
| SIM Swap | Lost or stolen SIM | `sim-swap-lost-stolen` |
| SIM Swap | Damaged SIM | `sim-swap-damaged` |
| SIM Swap | Device upgrade | `sim-swap-device-upgrade` |
| Number Porting | Port-in request | `porting-in` |
| Number Porting | Port-out request | `porting-out` |
| Number Porting | Porting delayed / failed | `porting-delayed-failed` |
| Activation | New SIM activation | `activation-new` |
| Activation | Reactivation | `activation-reactivation` |
| Activation | Activation delayed | `activation-delayed` |
| Billing Query | Incorrect charge | `billing-incorrect-charge` |
| Billing Query | Invoice request | `billing-invoice-request` |
| Billing Query | Payment not reflecting | `billing-payment-not-reflecting` |
| Network / Coverage Issue | No signal | `network-no-signal` |
| Network / Coverage Issue | Slow / no data | `network-slow-no-data` |
| Network / Coverage Issue | Call drops | `network-call-drops` |
| Network / Coverage Issue | Roaming issue | `network-roaming` |
| SIM Not Working | No service at all | `sim-no-service` |
| SIM Not Working | SIM not recognized by device | `sim-not-recognized` |
| SIM Not Working | SIM blocked/suspended | `sim-blocked-suspended` |
| Data / Airtime Query | Data not loading | `data-not-loading` |
| Data / Airtime Query | Airtime not loading | `airtime-not-loading` |
| Data / Airtime Query | Bundle / package query | `bundle-package-query` |
| Other | General inquiry | `other-general-inquiry` |
| Data | Data transfer | `data-transfer` |
| Data | Data activation | `data-activation` |
| Data | Data invalidate | `data-invalidate` |
| Pending confirmation | Errors | `pending-confirmation-errors` |
| Pending confirmation | Unbar failed | `pending-confirmation-unbar-failed` |
| Pending confirmation | Auto pending | `pending-confirmation-auto-pending` |
| Eligibility increase | Reached usage limit | `eligibility-increase-usage-limit` |
| CMP | Password reset | `cmp-password-reset` |
| CMP | Credentials request | `cmp-credentials-request` |
| Revenue Weaver | Password reset | `revenue-weaver-password-reset` |
| Revenue Weaver | Credentials request | `revenue-weaver-credentials-request` |
| SIM Lock | Location lock | `sim-lock-location` |
| SIM Lock | Device lock | `sim-lock-device` |
| SIM Lock | Compliance lock | `sim-lock-compliance` |
| Rica | Rica failure | `rica-failure` |
| Tariff migration | Migration failure | `tariff-migration-failure` |

That's 40 small triggers (one per row) — mechanical but one-time. The last
17 rows (Data through Tariff migration) were added 2026-07-17 for Canal+'s
new categories; the first 23 are unchanged. If you
add a new sub-category to `ISSUE_CATEGORIES` in `config.js` later, add its
matching trigger here too, otherwise new tickets in that sub-category just
won't get auto-tagged (nothing else breaks).

## 2. Configure the form

Edit `assets/config.js`:

```js
ZAMMAD_URL: "https://support.mvne.co.za",
ISSUE_CATEGORIES: [...],
PRIORITIES: [...],
```

### f) ICCID barcode scanning

Each ICCID field has a 📷 button that opens the phone/laptop camera and
decodes the barcode printed on the SIM (or its packaging) using
[ZXing](https://github.com/zxing-js/library), loaded from a CDN only when
someone actually taps the button — no dependency to install.

Two conveniences work together here:

- Clients can type or scan **just the last 10 digits** printed on the SIM,
  instead of the full ICCID. Whatever is entered — typed or scanned — gets
  auto-expanded by prepending `ICCID_PREFIX` (`assets/config.js`, default
  `892700000`) whenever it's exactly 10 digits. If your SIM stock uses a
  different prefix, change it there.
- If the barcode (or manual entry) already contains the full ICCID, it's
  left as-is.

**Camera access requires a "secure context"** — HTTPS, or `localhost` /
`127.0.0.1` for local dev. This is a browser restriction, not something
Zammad or this code can work around. VS Code's Live Server (below) serves
on `127.0.0.1`, so scanning works fine there; a `file://` page cannot use
the camera at all.

The scanner explicitly requests the **rear/environment-facing camera** at
1920x1080 and restricts decoding to the barcode symbologies ICCID labels
actually use (Code 128, Code 39, ITF, EAN-13) with ZXing's "try harder"
mode — without this, phones can default to the front (selfie) camera,
which has no autofocus and will never resolve a close-up barcode. If
scanning still won't lock onto a barcode: fill most of the video frame with
just the barcode, hold the phone steady for a second, make sure it's in
focus (tap the barcode on-screen if your phone supports tap-to-focus), and
avoid glare off the SIM card's glossy surface. Manual entry always works
as a fallback regardless.

## 3. Run it locally

This is a static site (plain HTML/CSS/JS) — no Node or Python required.
Open `index.html` directly via `file://` if you just want to look at the
form, but **don't try to submit or scan barcodes that way** — camera access
needs a secure context and some of Zammad's request handling behaves
inconsistently with a `file://`/`null` origin. Serve it over `http://`
instead:

- **Easiest (VS Code):** install the "Live Server" or built-in "Live
  Preview" extension, right-click `index.html` → "Open with Live Server".
- **Alternative:** any static file server pointed at this folder works — the
  app has no server-side logic at all.

## 4. Host it online later

Since there's no backend, deployment is just "upload these files":

- Any static host (Netlify, Vercel, GitHub Pages, S3 + CloudFront, or a
  folder on your existing web server) works unchanged — no CORS
  configuration needed on the Zammad side per domain, since that endpoint is
  open to all origins already.
- Serve over HTTPS in production as best practice.
- No environment variables or secrets to manage — everything in `config.js`
  is intentionally non-secret.

## Notes

- Per affected number, only **one of MSISDN or ICCID is required** — not
  both. If a client only knows one of the two, the row still validates as
  long as whichever one they did fill in is a valid value.
- MSISDN accepts `0821234567` or `+27821234567` style input (9-13 digits).
- ICCID accepts 18-22 digits, or exactly 10 digits (auto-expanded with
  `ICCID_PREFIX`, see barcode scanning above).
- The barcode scanner is loaded from `cdn.jsdelivr.net` with a pinned
  version and Subresource Integrity hash — if that CDN is blocked on your
  network, the "Scan" button will show an error but manual entry still
  works normally.
- Attachments are capped client-side at 5 MB (`MAX_ATTACHMENT_BYTES` in
  `config.js`); Zammad's own server-side limit still applies on top of this.
- Errors surface on the page (network failures, Zammad validation errors,
  spam-protection rejections) rather than failing silently, so
  misconfiguration should be obvious during testing.
- Verified against the live instance while building this: `form_config` and
  `form_submit` both resolve correctly (no more 404), but `form_config`
  currently returns `403 Forbidden` because the Form channel isn't enabled
  yet — that's step 1a above, not a bug in this code.
