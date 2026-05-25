import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const supabase = await createSupabaseServerClient();

  if (code) await supabase.auth.exchangeCodeForSession(code);

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) await ensureUserProfile(user);

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
