import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = db().prepare(`SELECT mime, bytes FROM uploads WHERE id=?`).get(id) as { mime: string; bytes: Buffer } | undefined;
  if (!row) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(row.bytes), { headers: { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable" } });
}
