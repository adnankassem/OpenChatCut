# White-label branding

OpenChatCut can wear another product name, mark and accent colour without a code change. Point `OPENCHATCUT_BRAND_DIR` at a directory that holds `brand.json` and the image files it names; the server serves that directory read-only at `/brand/*` and the client applies the file once at boot (`src/brand.ts`). With the variable unset every `/brand/*` request is a 404 and the upstream look is unchanged.

```
OPENCHATCUT_BRAND_DIR=/data/brand
```

`brand.json`:

```json
{
  "name": "Acme Edit",
  "title": "Acme Edit",
  "icon": "acme-icon.png",
  "wordmark": "acme-wordmark.png",
  "wordmarkWidth": 96,
  "accent": "#eb8c1a",
  "accentDeep": "#c9740f",
  "onAccent": "#101010",
  "locale": "en",
  "hideUpstreamLinks": true
}
```

| Field | Effect |
|---|---|
| `name` | Product name in the title bar and chat panel (rendered as text when no `wordmark` is given) and as the collapsed chat rail label. |
| `title` | Browser tab title; defaults to `name`. |
| `icon` | Favicon and the small brand mark. Any image format a browser renders. |
| `wordmark` | Wordmark image for the title bar and chat header. Rendered at `wordmarkWidth / 4` px tall, width auto. |
| `accent`, `accentDeep`, `onAccent` | Hex colours layered over every skin (`--cc-accent`, `--cc-accent-deep`, `--cc-on-accent`). Keep `onAccent` at 4.5:1 or better against `accent`. |
| `locale` | Interface language (`zh`, `en`, `it`, `ru`) used until the person picks one in the language switcher. |
| `hideUpstreamLinks` | Hides the repository and contact links and the upstream release check. |

File names are served from the brand directory only; sub paths are refused. Every field is optional. The Settings dialog still shows the upstream version number and the licence, which the AGPL requires for a network service.
