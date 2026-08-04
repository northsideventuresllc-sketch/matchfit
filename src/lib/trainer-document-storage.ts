import "server-only";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin-client";

/**
 * Storage for Fitness Pro compliance documents (certifications, W-9s, ID).
 *
 * These used to be written with `fs.writeFile` into `public/uploads/`. That cannot work in
 * production: the serverless filesystem is read-only, so every upload failed regardless of
 * file size, and anything that did land was both world-readable by URL and gone on the next
 * deploy. Uploads now go to a PRIVATE Supabase Storage bucket and are read back through
 * short-lived signed URLs.
 *
 * Local development without Supabase keys still writes to `public/uploads/` so the flow can be
 * exercised offline. Values stored before this change keep their `/uploads/...` shape and are
 * resolved unchanged — nothing needs backfilling.
 */

export const TRAINER_DOCUMENT_BUCKET = "match-fit-fp-documents";

/** How long a generated view link stays valid. Long enough to open a PDF, short enough not to share. */
const SIGNED_URL_TTL_SECONDS = 60 * 10;

const STORAGE_PREFIX = "storage:";

export function trainerDocumentStorageConfigured(): boolean {
  return isSupabaseAdminConfigured();
}

/** True for a reference produced by Supabase Storage rather than the legacy local path. */
export function isStoredDocumentReference(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(STORAGE_PREFIX));
}

let ensureBucketPromise: Promise<void> | null = null;

/** Creates the private bucket on first use so no manual dashboard step is needed to deploy. */
async function ensureBucket(): Promise<void> {
  ensureBucketPromise ??= (async () => {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage.getBucket(TRAINER_DOCUMENT_BUCKET);
    if (data && !error) return;
    const { error: createError } = await admin.storage.createBucket(TRAINER_DOCUMENT_BUCKET, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
    });
    // A parallel request may have created it between the two calls — that is not a failure.
    if (createError && !/already exists/i.test(createError.message ?? "")) {
      throw new Error(`Could not prepare document storage: ${createError.message}`);
    }
  })();

  try {
    await ensureBucketPromise;
  } catch (e) {
    ensureBucketPromise = null;
    throw e;
  }
}

/**
 * Writes a document and returns the reference to persist on the profile row.
 * `key` is the storage path, e.g. `trainers/<trainerId>/cert.pdf`.
 */
export async function putTrainerDocument(args: {
  key: string;
  bytes: Buffer;
  contentType: string;
}): Promise<string> {
  if (!trainerDocumentStorageConfigured()) {
    // Local development only.
    const relative = `/uploads/${args.key}`;
    const outPath = path.join(process.cwd(), "public", relative.replace(/^\//, ""));
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, args.bytes);
    return relative;
  }

  await ensureBucket();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(TRAINER_DOCUMENT_BUCKET).upload(args.key, args.bytes, {
    contentType: args.contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Could not store the document: ${error.message}`);
  }
  return `${STORAGE_PREFIX}${args.key}`;
}

/** Removes a previously stored document. Never throws — a missing file is not an error. */
export async function deleteTrainerDocument(reference: string | null | undefined): Promise<void> {
  const ref = reference?.split("?")[0]?.trim();
  if (!ref) return;

  try {
    if (isStoredDocumentReference(ref)) {
      if (!trainerDocumentStorageConfigured()) return;
      const admin = createSupabaseAdminClient();
      await admin.storage.from(TRAINER_DOCUMENT_BUCKET).remove([ref.slice(STORAGE_PREFIX.length)]);
      return;
    }
    if (ref.startsWith("/uploads/")) {
      await unlink(path.join(process.cwd(), "public", ref.replace(/^\//, "")));
    }
  } catch {
    // Missing or already-removed file — nothing to clean up.
  }
}

/**
 * Turns a stored reference into something a browser can open. Legacy `/uploads/...` values are
 * returned unchanged; Storage references become a short-lived signed URL. Returns null when the
 * document cannot be resolved, so callers can render "unavailable" instead of a broken link.
 */
export async function resolveTrainerDocumentUrl(reference: string | null | undefined): Promise<string | null> {
  const ref = reference?.trim();
  if (!ref) return null;

  if (!isStoredDocumentReference(ref)) {
    return ref;
  }
  if (!trainerDocumentStorageConfigured()) return null;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from(TRAINER_DOCUMENT_BUCKET)
      .createSignedUrl(ref.slice(STORAGE_PREFIX.length), SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      console.error("[resolveTrainerDocumentUrl] createSignedUrl", error);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.error("[resolveTrainerDocumentUrl]", e);
    return null;
  }
}
