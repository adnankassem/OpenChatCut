# PropelX patches on top of upstream OpenChatCut

Branch `propelx/reverse-proxy`, based on upstream commit `b49d5cff` (0xsline/OpenChatCut, 21 Sep 2026).

OpenChatCut is licensed under the AGPL. PropelX runs this modified copy for network users (a Cloudflare tunnel and a Tailscale Serve front on a media team's server), so this fork publishes the exact source that runs, as section 13 of the licence requires. Nothing else in the tree is changed.

## What the patch does

Two server files change, three hunks in total. They add one optional environment variable, `OPENCHATCUT_TRUSTED_HOSTS`, a comma separated list of hostnames that a loopback reverse proxy presents to the app.

1. `server/project-store-http-auth.ts` (`loopbackHost`)
   The project store trusts a request only when the TCP peer is loopback and the `Host` header names `localhost`, `127.0.0.1` or `::1` (DNS rebinding defence). Behind a reverse proxy the socket is still loopback but `Host` is the public name, so every store call returned 403 and the browser fell back to an empty in-memory store. The patch lets hostnames listed in `OPENCHATCUT_TRUSTED_HOSTS` pass the `Host` check. The loopback socket check and the `Origin` equals `Host` check for writes are untouched.

2. `server/editor-auth.ts` (`requestEditorOrigin`, host allowlist)
   Every editor route (media, uploads, previews) runs the same `Host` allowlist. The same variable extends it.

3. `server/editor-auth.ts` (`requestEditorOrigin`, forwarded protocol)
   The expected `Origin` is built from the socket type, so behind a TLS terminating proxy it came out as `http://host` while the browser sent `https://host`, and every ranged media GET was refused (the UI then showed every asset as offline). For hosts in `OPENCHATCUT_TRUSTED_HOSTS` only, the scheme now comes from `X-Forwarded-Proto` when it says `https`. Both cloudflared and `tailscale serve` send that header.

## What it does not do

- It does not accept non loopback sockets. The proxy must run on the same host and connect to 127.0.0.1.
- It does not change the MCP bearer token, the `Origin` check on writes, or `OPENCHATCUT_EDITOR_URL` (which pins a single origin and would have broken the localhost and MCP tooling next to the public name).
- With the variable unset, behaviour is identical to upstream.

## Running it

```
OPENCHATCUT_TRUSTED_HOSTS=edit.example.com,box.tailnet.ts.net
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=edit.example.com,box.tailnet.ts.net
```

The second variable is Vite's own host allowlist for the dev server; both are needed.

Deployment notes (Docker image, compose, Cloudflare Access) live in the PropelX run-book repo, not here.

## Branch `propelx/urbn-brand` (on top of `propelx/reverse-proxy`)

Adds an optional white-label layer, documented in `BRANDING.md`: `OPENCHATCUT_BRAND_DIR` names a directory served at `/brand/*` (`server/branding.ts`); the client reads `/brand/brand.json` before the first render (`src/brand.ts`) and applies product name, tab title, favicon and brand mark, wordmark image, accent colour, default interface language, and whether the upstream repository, contact and release-check links are shown. Components touched: `icons.tsx` (`BrandMark`, `OpenChatCutWordmark`), `ChatPanelView.tsx` (collapsed rail label), `DashboardHeaderLinks.tsx`, `Dashboard.tsx`, `main.tsx`, and the plugin list in `config/vite.config.ts`. No brand strings live in the code; with the variable unset the behaviour is identical to the branch below it.

The same branch adds `OPENCHATCUT_SELF_ORIGIN` (`server/agent-runs/request.ts`): server-side agent runs call the app's own `/llm` proxy on the origin the browser used, which behind a reverse proxy is the public hostname on port 80 (connection refused, the chat shows "Cannot connect to API"). Set it to `http://127.0.0.1:5199` so those calls stay on loopback. Unset, behaviour is unchanged. It also refreshes `assets/model-capabilities/models-dev.json` from models.dev (`npm run update:model-capabilities`, adds the gpt-6 and claude 5.1/5.5 entries) and updates the one verify assertion that pins a catalog value.
