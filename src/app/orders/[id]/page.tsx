import { Receipt } from "@/components/Receipt";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Receipt id={id} />;
}
