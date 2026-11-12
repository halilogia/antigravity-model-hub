# Legal and terms notes

Checked 2026-11-12. This is a good-faith summary, not legal advice. Re-read the sources before publishing or distributing.

## Licenses
- This project: Apache-2.0, derivative of `vahapogut/antigravity-add-model` (commit `e77954b`). `LICENSE` and `NOTICE` are retained; changes are listed in `NOTICE`.
- `anygate` (MIT) is not included. If its code is added, keep its MIT notice.
- Dependencies in `package-lock.json` are permissive (MIT, Apache-2.0, ISC, BSD, BlueOak, MPL-2.0, CC0, Python-2.0, MIT-0). MPL-2.0 files stay under MPL-2.0 if modified.

## Marks
Not affiliated with Google (Antigravity), OpenCode or the upstream author. Google's Antigravity icon and logo are not used; `icon.png`, tray templates and `gateway/dashboard/logo.png` are neutral generated placeholders. Product screenshots in `assets/` show third-party UI for identification only.

## Google Antigravity terms (https://antigravity.google/terms)
- Section 6: using third-party software, tools or services to access the Service is a breach (example given: OpenClaw with Antigravity OAuth); it may lead to suspension of Antigravity and/or Gemini CLI accounts.
- Section 8: if a third-party or open-source model is the main agent model, that model's terms apply.
- No clause on modifying or reverse engineering the application was found.
- Risk: this project patches the installed app and routes the chosen model's requests to OpenCode. Whether this counts as "third-party tools accessing the Service" is not settled by the text. Personal local use with your own OpenCode key and no Google OAuth reuse is the lowest-risk reading. Do not route Google-account tokens through it.

## OpenCode terms (https://opencode.ai/legal/terms-of-service)
- Use is for your own internal use, not on behalf of third parties; third-party model access depends on keys you hold.
- No multiple accounts to circumvent limits; no unreasonable load; no scraping or programmatic extraction of Output; no using Output to train competing models.
- Go and Zen are not named in these terms. Check the Go/Zen plan pages for client restrictions.

## Secrets
API keys are stored encrypted locally (`opencode-connections.json`). No keys are committed. A repository scan found no key patterns outside test fixtures.
