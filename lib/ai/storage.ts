import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function storeAiResult(input: {
  userId: string;
  jobId: string;
  bytes: ArrayBuffer;
  contentType: string;
  extension: string;
}) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "ai-results";
  const path = `${input.userId}/${input.jobId}.${input.extension}`;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(path, input.bytes, {
    upsert: true,
    contentType: input.contentType
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
