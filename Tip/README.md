# TIP

A coded version of Anqi Lu’s original TIP Figma website, focused on Scenario 2. The original wording, section order, restaurant scenes and layout are preserved. A new rotatable glasses model replaces the product image in its existing space.

**Live:** https://sqh393991-glitch.github.io/UIUX/Tip/

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. This is a normal HTML, CSS and JavaScript project; it does not require Figma or a Figma subscription.

## Edit

| File | Contents |
| --- | --- |
| `src/main.js` | Page sections, copy, icons and layout markup |
| `src/style.css` | Typography, colors, spacing, responsive layout and motion |
| `src/coordination-state.js` | Shared task, availability and outgoing-request state |
| `src/coordination.js` | Task cards, forms, messages and state rendering |
| `src/panorama.js` | Restaurant look-around, focus controls and full screen |
| `src/viewer.js` | Three.js lighting, orbit controls and model views |
| `public/models/tip-01.glb` | Original 3D glasses geometry for the web |
| `design/TIP-01.blend` | Editable Blender model and studio setup |
| `public/assets/` | TIP logo, restaurant imagery and local Inter font |

Theme colors: `#93A4C1`, `#EEBF79`; typeface: Inter.

## Build and publish

```sh
npm test
npm run build
```

From the repository root, run `node scripts/build-pages.mjs` to build `Tip/` and update `docs/Tip/`. Commit both the source and generated `docs/` files. GitHub Pages uses the `main` branch, `/docs` directory. All production assets use relative URLs so the project also works in another subdirectory. No runtime CDN is needed.

## Interaction scope

- Drag the glasses to rotate; choose Front, Side, or 3/4; use Home to reset or arrow keys to rotate while focused.
- Drag the restaurant image left/right, use the three view buttons, or recenter. This preserves the original panoramic photograph interaction; the restaurant is not a full 3D reconstruction.
- Request → Accept → Arrive → Coordinate → Handback → Complete. The panorama and step walkthrough share state. The four tabs preview stages; the actual task path requires Alex to confirm the handback.
- Dismiss and undo, local messages, request dropdowns with edit/cancel, shift notes and availability work in the browser.
- Incoming Alex requests and outgoing Allyson requests are separate. Busy/Break pauses new requests but does not erase accepted coverage.
- Refresh resets the demonstration. No backend, camera, microphone, employee tracking, or real messages are used.

## Concept and asset credits

This is a 2036 design concept. The website is functional; the physical glasses are a visual industrial-design study, not a certified or engineered wearable. It is not for sale.

Design and TIP logo: Anqi Lu. Original geometry, interface implementation and site production developed with AI assistance. Restaurant panoramas are AI-generated images from the earlier TIP project. Three.js is MIT-licensed; Inter uses the SIL Open Font License. Notices are in `THIRD_PARTY_NOTICES.md`. No stock glasses mesh is used in this version.

Product prices and specifications are retained from the original speculative design and are not claims about manufactured hardware. No product is offered for sale.
