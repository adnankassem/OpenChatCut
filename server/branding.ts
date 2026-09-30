// Optional white-label branding. `OPENCHATCUT_BRAND_DIR` names a directory that holds
// `brand.json` plus any image files it references (icon, wordmark). The directory is
// served read-only at `/brand/*`; the client fetches `/brand/brand.json` once at boot
// (src/brand.ts) and applies it. With the variable unset every `/brand/*` request is a
// 404 and the product keeps its upstream name, mark and colours.
import { existsSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { sendProductAsset } from './product-assets.ts';

export const BRAND_DIR_ENV = 'OPENCHATCUT_BRAND_DIR';
export const BRAND_URL_PREFIX = '/brand/';

export function brandDir(): string | null {
  const raw = process.env[BRAND_DIR_ENV]?.trim();
  if (!raw) return null;
  const dir = resolve(raw);
  return existsSync(dir) ? dir : null;
}

/** Resolve `/brand/<file>` to a regular file inside the brand directory. Rejects traversal. */
export function resolveBrandAsset(urlPath: string): string | null {
  const dir = brandDir();
  if (!dir) return null;
  let clean: string;
  try {
    clean = decodeURIComponent((urlPath.split('?')[0] ?? ''));
  } catch {
    return null;
  }
  if (!clean.startsWith(BRAND_URL_PREFIX) || clean.includes('\0')) return null;
  const file = resolve(dir, clean.slice(BRAND_URL_PREFIX.length));
  const prefix = dir.endsWith(sep) ? dir : dir + sep;
  if (!file.startsWith(prefix) || !existsSync(file)) return null;
  try {
    return statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

export function brandingPlugin(): Plugin {
  return {
    name: 'openchatcut-branding',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith(BRAND_URL_PREFIX) || (req.method !== 'GET' && req.method !== 'HEAD')) {
          next();
          return;
        }
        const file = resolveBrandAsset(url);
        if (!file) {
          // Never fall through to the SPA index: the client treats a 404 as "no brand".
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end('{"error":"no brand asset"}');
          return;
        }
        try {
          await sendProductAsset(req, res, file);
        } catch {
          next();
        }
      });
    },
  };
}
