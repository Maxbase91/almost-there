# Almost There: Product Requirements

Status: describes v6 as implemented (2026-10). Gameplay detail lives in [GAME-DESIGN.md](GAME-DESIGN.md); the
reasoning behind each change lives in [DECISIONS.md](DECISIONS.md). This document does not repeat them.
Statements marked *Inferred* come from the code and git history, not from a written owner brief.

## 1. Vision

A tiny, brutal browser runner: carry a birthday cake 100 m to a party table. Every run is a new course, every death
names its cause, and reaching the table is a real but rare win (target about 1 in 20 runs for a good player, D16).
The joke is the near miss: the game makes you feel you almost made it.

## 2. Target users and jobs to be done

*Inferred.*

| User | Job |
| --- | --- |
| Casual player on a phone or laptop | "Give me a one-tap game I can try again in under a second." |
| Someone sharing a link | "Send a friend something silly they will play ten times." |
| The owner | A showcase of a small, dependency-free game with tested logic (also embedded on the owner's landing page). |

## 3. Scope

In scope (implemented):
- One static page, playable on desktop (Space / ↑ / W) and touch (tap; tap again mid-air for a double jump).
- Seeded random course per run across four biomes, 27 hazard types, speed ramp (GAME-DESIGN §2–3).
- Honest loss: the game freezes on a fail card naming the hazard and distance; retry only on explicit input (D2).
- Real win at the table with fanfare and a win counter (D16).
- Run log in `localStorage`: deaths per hazard, attempts, wins, best distance; resettable.
- Optional legacy mode `?endings=1` with 22 scripted joke endings and a "Failure Journal".
- Music and sound effects with a persistent mute toggle (M key or SND button).
- Dev query parameters for reproducible courses and headless screenshots (README "Dev query params").

Out of scope (not implemented, no plan found):
- Accounts, server-side leaderboards, analytics, ads, payments. The app makes no network calls except loading its
  own static files and the Google Fonts stylesheet/font.
- Levels, settings menus, difficulty selection, localisation (English only).

## 4. Functional requirements

| ID | Requirement | Status |
| --- | --- | --- |
| F1 | A run starts from the title, a death card or the win screen with one input. | Implemented |
| F2 | Each run generates a new course from a fresh seed; `?seed=N` reproduces one. | Implemented, tested |
| F3 | Every course is beatable by a flawless player. | Implemented, tested over 500 seeds |
| F4 | A hazard hit freezes the game on a fail card; no auto-restart. | Implemented, tested |
| F5 | Reaching the table is a win. | Implemented, tested |
| F6 | The run log survives reloads and tolerates corrupt or missing storage. | Implemented, tested |
| F7 | Mute state survives reloads. | Implemented, not unit-tested |
| F8 | Legacy endings never repeat until all have been seen. | Implemented, tested |
| F9 | Portrait phones get a "rotate your phone" hint. | Implemented |
| F10 | `prefers-reduced-motion`: no shake, blackouts dim calmly instead of flickering. | Implemented, logic tested |
| F11 | Pinch zoom allowed without breaking tap controls. | Implemented |
| F12 | Shareable: canonical URL, Open Graph image, robots.txt, sitemap. | Implemented |

## 5. Non-functional requirements

- No build step, no runtime dependencies; any static host works (D1).
- Runs at 60 fps on a mid-range phone. *Open question:* no measured budget exists.
- Pure game logic is deterministic per seed and covered by Vitest; rendering is checked with headless screenshots.
- Security: static site, strict security headers and CSP in `vercel.json`, no user data leaves the browser.
- Assets are CC0 (fonts: SIL OFL), listed in [`assets/LICENSES.md`](../assets/LICENSES.md).

## 6. Success metrics

*Inferred; nothing is measured in production (no analytics by design).*
- Human-like synthetic player reaches the table on 2–20 % of seeds (test band, D16); real players do worse.
- Flawless synthetic player reaches the table on 100 % of seeds.
- Qualitative: players retry several times per session.

## 7. Risks

- Difficulty tuning relies on a synthetic player; real-player difficulty is unmeasured.
- Accessibility is limited (see DESIGN.md §6): gameplay is canvas-only. Zoom and reduced motion are supported.
- The landing-page embed is a manual copy and can drift from this repo.

## 8. Open questions

- Should the embedded copy on the landing page be generated from this repo rather than copied by hand?
  (Owner, 2026-10-24: not copying the game there for now.)
