import { z } from "zod";
import { adminTokenOk } from "@/lib/auth";
import { isAdmin, setAdminCookie, clearAdminCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ admin: await isAdmin() });
}

export async function POST(req: Request) {
  const parsed = z.object({ token: z.string() }).safeParse(await req.json());
  if (!parsed.success || !adminTokenOk(parsed.data.token)) return Response.json({ error: "Wrong token." }, { status: 403 });
  await setAdminCookie();
  return Response.json({ admin: true });
}

export async function DELETE() {
  await clearAdminCookie();
  return Response.json({ admin: false });
}
