import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  return NextResponse.json({
    authenticated: Boolean(user),
    userId: user?.id ?? null,
    email: user?.email ?? null,
    error: error?.message ?? null
  });
}
