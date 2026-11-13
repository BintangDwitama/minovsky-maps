## Why

Players can build a scenario but can only pass it on as a `.json` file or a PNG, and the only way to look at a scenario is to open the editor. To move toward sharing (the project's goal) without a server yet, a creator should be able to send one link that opens a readable, printable scenario sheet for the other player — and the app must be reachable at a public address for that link to work.

## What Changes

- **Share link from the editor:** a Share action encodes the current scenario into a link and copies it. The scenario travels entirely in the URL fragment (`#/view/1.<payload>`): no server stores or sees it.
- **Compact, versioned link encoding:** a compact form of the scenario (rectangular boards stored as their size, only non-default hexes listed, short keys), deflate-compressed and base64url-encoded, with a codec version prefix so links keep working as formats evolve. Decoding expands back to a normal scenario document and runs the existing migrate → schema → integrity pipeline.
- **Scenario sheet page:** a read-only view for the receiving player — title, author, description, the board, rules, goals, and a setup checklist (pillars per level, components per side and kind, labelled tokens/structures/objectives). Actions: Edit a copy, Copy link, Download `.json`, Export PNG, Print.
- **Print layout:** the sheet prints on A4 in light colours with the board first and the checklist and goals after it.
- **Routing:** a minimal hash router: `#/` editor, `#/view/<link>` sheet.
- **Hosting:** the web app is deployed as a static site on Cloudflare Pages (free `*.pages.dev`); the repo documents the one-time setup.

Sides touched: **web only**. No server, no schema change.

## Capabilities

### New Capabilities
- `link-sharing`: Creating a share link from the editor, the compact versioned link format, decoding and validating links, and opening a shared scenario in the editor as a copy.
- `scenario-sheet`: The read-only scenario sheet: content, setup checklist, actions, and print layout.

### Modified Capabilities
- None. Existing file save/load, PNG export and the editor are unchanged; the editor only gains a Share button.

## Non-goals

- No backend, accounts, short links, publishing, library or browsing (Slices 2–3).
- No custom domain yet (free `*.pages.dev`; a later move keeps old links working via a fragment-preserving redirect, see design).
- No link previews/thumbnails in chat apps: the scenario is in the fragment, which crawlers never see.
- No `schemaVersion` change; scenario files are untouched.
- No editing on the sheet page.

## Impact

- **Code (web):** new domain modules (link codec, setup summary), application use cases (share, open shared), infrastructure adapters (deflate, clipboard), UI (router, SheetPage and its organisms, Share button, print styles).
- **Dependencies:** `fflate` (small deflate library, synchronous, works in Node tests).
- **Deployment:** Cloudflare Pages project connected to the GitHub repo (build in `web/`, output `web/dist`); `web/.nvmrc` pins the Node version; README gains a Deploy section.
- **Risk:** links are permanent once shared — the codec version prefix and the redirect plan address format and host changes.
