# Verification log — token-radar-01 (rebuild against the kit's sealed snapshot)

Rebuilt 25 Nov 2026, ~11:10–11:30 WIB, on the Muse VM (Node v24.22.1).
Entry NOT submitted. No login to make.fun, no credentials used, no paid API called.
User permission 25 Nov 2026 ~11:04 WIB ("saya ijinkan") covers processing the kit, 2 public GitHub repos, and submit — this task is prep + rebuild + verification only.

## Kit (processed 25 Nov 2026 ~11:11–11:15 WIB)

- Kit URL: `https://make.fun/c/token-radar-01/kit` — HTTP 200, 8,795,245 bytes, sha256 `c7aad59818c0bc70f23142ce5f739740b0607519d87149eef59a361d7237061f`. Downloaded without credentials. Saved as `~/workspace/make-fun/token-radar-01-kit.tar.gz`, extracted to `~/workspace/make-fun/token-radar-01-kit/`.
- Kit contents: `kit.json` (format agent-fun/kit/v1), `RULES.txt` (425 lines), `cli/makefun.mjs`, `competition.yaml`, `harness/`, `input/snapshot.json`, `starter/` (main.ts, lib/model.ts, dashboard/, vendor/makefun-board.ts, screenshots/).
- Kit snapshot: as of 2026-11-14, source DefiLlama protocols list, floor $50,000,000, **758 protocols, watchlist 40 slugs**, sha256 `42a71213519479f3a180cc5010cbbf6bd18a2447fa0ad29e4c5122b6c9184393` (recorded in the kit's `kit.json`; `main.ts` refuses to build from a file whose hash differs).
- Starter run as a reference test (25 Nov ~11:21 WIB, in `/tmp/starter-run/`, never shipped): exit 0, 200 rows (40 watchlist + 160 early below the floor), 24 live, dossier 705,011 bytes. Its board has no Polymarket (early rows are below the floor only) and its top row is Steakhouse Financial ($544M implied under the starter's fixed-0.25 model).

## What passed (rebuild)

| # | Check | Result |
|---|---|---|
| 1 | Node version | v24.22.1 (≥ 22.18 ✓) |
| 2 | Snapshot integrity | kit snapshot sha256 `42a71213…` matches `kit.json`; `main.ts` verifies it on every run and refuses a mismatch ✓ |
| 3 | `vendor/makefun-board.ts` copied from the kit starter | sha256 `9ca51b6e…` matches `kit.json` exactly ✓ (the kit says copy it; a copy elsewhere counts as lines you wrote) |
| 4 | `node main.ts` run | board.json + data.js written, then exit 1 ONLY at the screenshot gate (0 screenshots — the designed behaviour until the browser step) |
| 5 | Board rows | **197 rows** (requirement ≥ 100 ✓): 40 watchlist + 157 early (the early pool is exhausted — 302 pre-token non-watchlist, 145 excluded by the house rule: CEX 42, Liquid Staking 38, Bridge 28, Canonical Bridge 15, versioned names 11, wrapped/staked names 5, Liquid Restaking 3, Restaked BTC 2, Cross Chain Bridge 1) |
| 6 | Watchlist coverage | 40 / 40 ✓, no missing slugs, no rows outside the snapshot |
| 7 | Ranks + order | ranks sequential 1..197 ✓; implied value non-rising with rank ✓; not all equal ✓ |
| 8 | Implied values | all 197 are positive safe integers ✓ |
| 9 | Farm plans | 6 steps per row, 197/197 ✓; every step 20–600 chars (0 violations) ✓ |
| 10 | Peer multiples | 128 tokenized peers with a usable market cap; global median 0.214x; 9 categories with ≥ 5 peers; 76 rows use a category median, 121 use the global median (documented in the model + the dashboard) |
| 11 | Determinism | two consecutive runs → byte-identical sha256 for `out/board.json` (`670b923a…`) and `out/data.js` (`02b1ffed…`) ✓ |
| 12 | Dashboard static / no network | `dashboard/` is 3 files (index.html 572 B, app.css 7,316 B, app.js 26,755 B; total 34,643 B ≤ 65,536 dossier text cap ✓); no `https://` or `http://` literal in any dashboard file ✓; no external links at all (the old dashboard's protocol-site + X links were removed — the gate forbids them) |
| 13 | Dashboard data integrity | `data.js` rows == `board.json` rows (rank/slug/implied) ✓; `data.js` farm_steps == board farm_steps ✓; live view 24 rows ✓ |
| 14 | Dossier pipeline | pipeline test with the starter's 3 screenshots as TEST INPUT only (deleted right after): `main.ts` exit 0, `out/dossier.json` 710,144 bytes (≤ 1.5 MiB ✓), text 34,907 bytes (≤ 65,536 ✓), 3 images, cover 0. The test dossier + test screenshots were removed afterwards — `out/` now holds only board.json, data.js, dashboard/ ✓ |
| 15 | LICENSE | MIT (OSI-approved ✓) |
| 16 | Deep links (code-verified) | `#detail=<slug>`, `#q=&cat=&chain=&minTvl=&tab=` implemented in `app.js` — not render-verified (no usable browser on this VM; see blocked item 2) |
| 17 | Watchlist anomalies | none — all 40 watchlist slugs are pre-token and pass the rankable rule ✓ |

## Model sanity (rebuild)

- #1 is **Sentora Curator** (Risk Curators, $2.76B TVL, implied $26.8M) — an early row, not a watchlist row. It has the highest TVL in the snapshot; the house left it off the watchlist for a reason the snapshot's ten fields cannot express (no `parentProtocol` field). Same situation as Polymarket (#13, $2.4M). Both are ranked on their snapshot figures alone, per the rules ("protocols left off the list are equally valid subjects").
- The peer multiples are thin in the sealed snapshot (only 9 categories have ≥ 5 peers), so the global median 0.214x does most of the work and TVL dominates the ranking. The single tokenized Risk Curators peer (2.98x) and the single Prediction Market peer (400.2x) are NOT used — the ≥ 5-peer rule protects the board from one-peer outliers. Documented in `lib/model.ts`, the README, and the dashboard's model panel.
- The old local build's named exclusions (Lightning Network, Bittensor dTAO) are GONE — both are on the watchlist itself, and the judge forbids hardcoded names. Bittensor dTAO ranks #8 (Dexs, 0.34x category median, $3.6M).
- The old build's broad category exclusions (Risk Curators, RWA, Onchain Capital Allocator, Chain, Yield, CDP, CeDeFi, ...) are GONE — the house put those categories on the watchlist, so excluding them would contradict the house's own rule. Only the house's rule is applied now (Bridge / Liquid Staking / Restaked BTC / CEX categories + versioned / wrapped / staked / CEX-brand names).

## Transcript bundle (prepared, NOT produced — see blocked item 4)

- `bundle --dry-run` (25 Nov ~11:28 WIB, after `git init`): **24 session files found**, including the 3 that built this entry — parent `26993228` (668 turns, 2,576 lines kept), build subagent `1b590b45` (31 turns, 120 lines kept), rebuild session `febefd39` (73 turns, 295 lines kept). The other 21 are earlier sessions that wrote files this build read (referensi-sosmed.md, Weir connector, riset skill, Khaira docs, Flop files) — bundle's "family", included by default.
- Muse usage rows (via `muse.db`, window from the build subagent's spawn 25 Nov 10:45 WIB): parent 101 rows + build subagent 1 row (its final report: 4,620,951 input / 39,369 output tokens, model `ipnext/avocado-5.17-v2`); rebuild session **0 rows — not written until this session's final report is delivered**. The parent must re-run the usage query after this report lands, then run the real bundle.
- Sessions start times: parent 2026-11-23T04:33:11Z, build subagent 25 Nov ~10:45 WIB, rebuild 25 Nov ~11:10 WIB — all after the competition opened (2026-11-14T10:00:00Z) ✓.
- Exact bundle command for the parent (after this report is delivered + after the git commit below):
  `node cli/makefun.mjs bundle --repo ~/workspace/make-fun/token-radar-01 --out transcripts.tar.gz --system-prompt ~/workspace/system/system_prompt.md --effort <level> --redact "Miftachul Huda" --muse-usage <usage-file> --harness <name> --harness-version <version> --provider <name> --model muse-spark-1.3`
  (run from inside the unpacked kit; `--dry-run` first. The `--harness/--provider/--effort` values are the ones the harness records — bundle reads them from a recorded log when it can; if it asks, use the Muse app's own names. Model id `muse-spark-1.3` == the `ipnext/avocado-5.17-v2` id in the app's log, per the requirements text.)

## GitHub push options (checked 25 Nov ~11:27 WIB)

- `gh` CLI: installed (`/usr/bin/gh`) but **NOT logged in** ("You are not logged into any GitHub hosts") — login is a browser step.
- No git identity anywhere on this VM: no `~/.gitconfig`, no user.name/user.email in any of the 6 cloned slowwilly20 repos. The commit author/email is an open decision (do NOT invent an email — the commit will be public on GitHub).
- Local repo: `git init` done in `~/workspace/make-fun/token-radar-01/`, branch renamed to `main`, `.gitignore` covers `out/`. **No commit yet** (needs the identity decision). `git status` shows the entry files untracked: `.gitignore`, `LICENSE`, `README.md`, `VERIFICATION.md`, `dashboard/`, `lib/`, `main.ts`, `vendor/`.
- No remote configured. The GitHub repo must be created fresh (after 14 Nov 2026) under `slowwilly20` via the browser, then `git remote add origin …` + push.

## Blocked / not done

1. **Screenshots (3) — NOT TAKEN.** No usable browser on this VM for rendering: direct `/opt/meta-chromium/chrome` refuses to start ("Hatch WebGL domain policy is required for browser startup"); the `hatch-chromium-sandbox` binary is the live-browser infrastructure and was not touched. The dashboard has hash deep-links ready: board plain, `#detail=polymarket-international`, `#cat=Prediction+Market`. Each shot must be 1440×900 and 300–350 KB (three at the 512 KiB cap would exceed the 1.5 MiB dossier). **Take them via the parent agent's live browser.**
2. **Dashboard visual render — NOT SEEN.** Verified structurally only (syntax, data, no-network, byte sizes, hash links). A human/browser look is still needed before submitting.
3. **Public GitHub repo — NOT CREATED.** Needs the browser (create under slowwilly20) + the commit-identity decision + push + About (website on make.fun + topic `makefun`) + commit SHA recorded.
4. **Transcript bundle — NOT PRODUCED.** Needs: this session's final report delivered (so its usage rows exist) → re-run the usage query → real `bundle` → then `check`. See the command above.
5. **Official `dossier.json` — NOT YET REAL.** The pipeline is proven (test dossier 710,144 bytes with test screenshots), but the real dossier is generated by `main.ts` only after the 3 real screenshots exist. Do NOT ship the test dossier.
6. **Submission — NOT DONE, by design.** Needs user approval + items 1–5, then the Solana keypair + `login` (browser) + `submit`.

## Before this entry can be submitted

- [x] User authorizes processing the make.fun kit → kit unpacked → `vendor/makefun-board.ts` → board rebuilt against the kit's sealed snapshot → pipeline verified
- [ ] 3 screenshots taken in a browser (board, protocol detail, filtered view) → `screenshots/` (each 300–350 KB, 1440×900)
- [ ] Dashboard eyeballed in a browser (layout, detail panel, filters, deep links)
- [ ] Git identity decided → commit → public GitHub repo created (fresh, after 14 Nov 2026) + code pushed + commit SHA recorded + About set
- [ ] Transcript bundle made with the kit CLI (`bundle`, after this session's report lands) → `check` run (`node cli/makefun.mjs check --kit . --repo <repo> --transcripts transcripts.tar.gz`)
- [ ] User approves the submission (5-stage protocol: entry submission is a one-way step) → wallet/keypair + login + submit

## File inventory (rebuild)

```
~/workspace/make-fun/token-radar-01/
├── main.ts                         6.6 KB  Node 22.18+, stdlib only (rewritten, starter shape)
├── lib/
│   └── model.ts                    28 KB   model peer-median-1 (written fresh)
├── dashboard/
│   ├── index.html                  572 B   shell (starter shape)
│   ├── app.css                     7.3 KB  dark theme (written fresh)
│   └── app.js                      26.8 KB dashboard logic (written fresh)
├── vendor/
│   ├── makefun-board.ts            19.8 KB COPIED from the kit starter (sha256 9ca51b6e… ✓)
│   └── NOTE.md                     updated: kit processed
├── screenshots/                    EMPTY — pending browser shots
├── .gitignore                      out/
├── LICENSE                         MIT
├── README.md                       rewritten for the kit build
├── VERIFICATION.md                 this file
└── out/ (local build output, gitignored)
    ├── board.json                  329 KB  197 rows, sha256 670b923a…
    ├── data.js                     317 KB  window.RADAR, sha256 02b1ffed…
    └── dashboard/                  copy of dashboard/ (3 files)
```

No secrets, no API keys, no credentials anywhere in this tree (verified: no key material was ever written here).

## Superseded: the local build (25 Nov 2026 ~10:45–11:00 WIB)

The first build used a live DefiLlama fetch sealed by hand (9,110 protocols, sha256 `82696120…52aee`, 382 rows, dashboard 358 KB single-file, provisional root `dossier.json`, named exclusions Lightning Network + Bittensor dTAO, broad category exclusions). It is superseded by the kit rebuild above: the hand-sealed snapshot (`data/`), the old outputs (`out/`), and the provisional `dossier.json` were removed. Its verification table is preserved in the parent agent's records; the facts that carry over are: Node 24.22.1, `main.ts` exit 0, determinism proven, MIT license, and the kit-block that the user's 11:04 WIB permission has now lifted.
