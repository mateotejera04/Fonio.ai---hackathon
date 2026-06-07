import { getRankedWaitlist } from "@/lib/waitlist.server"

// Live data — never cache; the dialog polls this once per second.
export const dynamic = "force-dynamic"

export async function GET() {
  const patients = await getRankedWaitlist()
  return Response.json(patients)
}
