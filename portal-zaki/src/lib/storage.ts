import { createClient } from "@supabase/supabase-js";
import { getStorageEnv } from "@/lib/env";

/**
 * Supabase Storage for payment proofs (blueprint §9 step 10). Uploads return a
 * SIGNED URL, never a public one. The client and env are built lazily at call
 * time so the web build needs no Supabase keys; tests inject a double.
 */

const BUCKET = "payment-proofs";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type StoredFile = { path: string; signedUrl: string };

export type ProofUpload = {
  bytes: Uint8Array;
  contentType: string;
  coCli: string;
  filename: string;
  stamp: number;
};

export type Uploader = (upload: ProofUpload) => Promise<StoredFile>;

export const uploadProof: Uploader = async ({
  bytes,
  contentType,
  coCli,
  filename,
  stamp,
}) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = getStorageEnv();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const path = `${coCli}/${stamp}-${filename}`;

  const uploaded = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (uploaded.error) {
    throw new Error(`storage upload failed: ${uploaded.error.message}`);
  }

  const signed = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signed.error || !signed.data) {
    throw new Error(`signed URL failed: ${signed.error?.message ?? "unknown"}`);
  }

  return { path, signedUrl: signed.data.signedUrl };
};
