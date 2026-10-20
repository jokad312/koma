import { connection, NextResponse } from "next/server";
import { creerClientService } from "@/lib/supabase/service";

export async function GET() {
  await connection();
  const { data, error } = await creerClientService().rpc("admin_sante");
  if (error || data !== 1) {
    return NextResponse.json({ ok: false, base: "indisponible" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, base: "connectee" });
}
