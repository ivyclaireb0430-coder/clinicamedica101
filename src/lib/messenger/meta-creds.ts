import { decryptJson, encryptJson } from "../crypto";
import { getSetting, setSetting } from "../settings";

// Facebook (Meta) keys can be entered in Settings instead of the server's clinic.env (the server's
// browser console doesn't accept a paste). Stored encrypted. A value set in clinic.env always wins.
// The rest of the app reads process.env, so saved values are copied into process.env at startup and on save.

export const META_FIELDS = {
  META_APP_ID: "App ID",
  META_APP_SECRET: "App Secret",
  META_PAGE_ID: "Page ID",
  META_PAGE_ACCESS_TOKEN: "Page access token",
  FB_PAGE_USERNAME: "Page username (hal. clinicamedica101)",
} as const;
export type MetaField = keyof typeof META_FIELDS;
export const SECRET_FIELDS: MetaField[] = ["META_APP_SECRET", "META_PAGE_ACCESS_TOKEN"];

const g = globalThis as unknown as { __metaFromServer?: Set<MetaField> };

/** Fields that were set in the server environment when the app started (these are never overridden). */
export function fieldsFromServer(): Set<MetaField> {
  g.__metaFromServer ??= new Set((Object.keys(META_FIELDS) as MetaField[]).filter((k) => process.env[k]));
  return g.__metaFromServer;
}

export async function loadStoredMetaCreds(): Promise<Partial<Record<MetaField, string>>> {
  return decryptJson<Partial<Record<MetaField, string>>>(await getSetting("metaCredsEnc")) ?? {};
}

/** Copy saved keys into process.env (only for fields not set on the server). */
export async function applyStoredMetaCreds(): Promise<void> {
  const fromServer = fieldsFromServer();
  const stored = await loadStoredMetaCreds();
  for (const k of Object.keys(META_FIELDS) as MetaField[]) {
    if (fromServer.has(k)) continue;
    if (stored[k]) process.env[k] = stored[k];
    else delete process.env[k];
  }
}

/** Save keys from the Settings form. Blank inputs keep the saved value. */
export async function saveMetaCreds(input: Partial<Record<MetaField, string>>): Promise<void> {
  const stored = await loadStoredMetaCreds();
  for (const k of Object.keys(META_FIELDS) as MetaField[]) {
    const v = input[k]?.replace(/\s+/g, "");
    if (v) stored[k] = v;
  }
  await setSetting("metaCredsEnc", encryptJson(stored));
  await applyStoredMetaCreds();
}

export async function clearMetaCreds(): Promise<void> {
  await setSetting("metaCredsEnc", "");
  await applyStoredMetaCreds();
}
