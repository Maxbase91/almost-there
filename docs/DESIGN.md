# Almost There: Visual Design

Status: v6 (2026-10). Written from `index.html`, `src/render.js` and `src/sprites.js`. Game feel and hazard
behaviour are in [GAME-DESIGN.md](GAME-DESIGN.md).

## 1. Principles

- Pixel art everywhere: no rounded corners, hard offset shadows, `image-rendering: pixelated`.
- The game canvas is the product; DOM overlays sit on top for text and buttons so they stay crisp and clickable.
- Every death is legible: a named fail card, never an unexplained restart (D2).

## 2. Tokens (CSS custom properties in `index.html`)

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#2b2b3a` | Text, borders, hard shadows |
| `--paper` | `#fff3dc` | Panel background |
| `--paper-dark` | `#e8c99a` | Inner panel border |
| `--wood` / `--wood-dark` | `#b5703a` / `#6f3f1c` | Wooden panels, subtitle text |
| `--pink` | `#f4a0b5` | Accent |
| `--red` | `#e5484d` | Danger panels, logo, Decline button |
| `--gold` | `#ffd166` | Primary button |
| `--mint` | `#5fbf5a` | Loading bar, Accept button |
| `--sky` | `#5fb3ff` | Canvas background before first paint |
| `--bg` | `#1b1b2f` | Page letterbox, `theme-color` |
| `--px` | `3px` | One "art pixel"; all borders and shadows are multiples |

## 3. Typography

- One face: "Press Start 2P" (Google Fonts, SIL OFL), fallback `"Courier New", monospace`.
- Fluid sizes with `clamp()`: logo 18–34 px, `h1` 16–30 px, `h2` 12–20 px, body 8–12 px, muted 7–10 px,
  journal cards 7–9 px.
- Canvas text uses the same font once `document.fonts.load` resolves.

## 4. Layout

- Logical canvas 960×540 (16:9), letterboxed to the viewport by `fit()`; sprites drawn at 3× their sheet size.
- Overlays (`.layer`) are full-stage flex containers centring one `.panel`.
- HUD buttons (SND, LOG) bottom right; smaller under 600 px width.
- Portrait phones under 600 px show "ROTATE YOUR PHONE FOR A BIGGER CAKE".

## 5. Components

| Component | Markup | Variants |
| --- | --- | --- |
| Panel | `.panel` | default (paper), `.wood`, `.danger` (red inner border and shadow) |
| Button | `.btn` | default (gold), `.ghost` (paper), `.pink` (red), `.mint`; pressed state shifts by one `--px` |
| Overlays | `#loading`, `#title`, `#dead`, `#win`, `#lost`, `#dialog`, `#terms`, `#journal` | Shown/hidden with the `hidden` attribute |
| Journal card | `.card` | `.seen` (solid border, white) vs unseen (dashed, faded) |

Art sources: Kenney "Pixel Platformer", "Tiny Farm", "UI Pack - Pixel Adventure" (CC0) plus hand-pixeled sprites in
`src/pixelart.js`. Full list: [`assets/LICENSES.md`](../assets/LICENSES.md).

## 6. Accessibility (current state)

- Keyboard: Space / ↑ / W jump and start, M mutes; all overlay buttons are real `<button>` elements.
- Mute button updates its `aria-label`; the canvas has `aria-label="Almost There game"`.
- Gaps (open questions, not fixed because they change behaviour):
  - `user-scalable=no` in the viewport meta blocks pinch zoom.
  - No `prefers-reduced-motion` handling: screen shake and blackout hazards always play.
  - Overlays are not modal dialogs (no focus move or focus trap); focus stays where it was.
  - Gameplay information exists only on the canvas; screen readers get the overlay text only.
  - No `h1` on the page (the logo is a `div`), no Open Graph or canonical tags.
  - Muted text uses `opacity: 0.7` on paper; contrast has not been measured.
