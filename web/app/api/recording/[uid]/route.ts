import { getCall } from "@/lib/calls"

// Streams a call's recording back through our origin with an attachment
// disposition so the browser saves it as a file. We look the URL up from the
// call document by id (rather than accepting a URL param) to avoid SSRF.
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/recording/[uid]">,
) {
  const { uid } = await ctx.params
  const call = await getCall(uid)

  if (!call?.audioLink) {
    return new Response("No recording for this call", { status: 404 })
  }

  const upstream = await fetch(call.audioLink)
  if (!upstream.ok || !upstream.body) {
    return new Response("Failed to fetch recording", { status: 502 })
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
    "Content-Disposition": `attachment; filename="conversation-${uid}.mp4"`,
  })
  const length = upstream.headers.get("content-length")
  if (length) headers.set("Content-Length", length)

  return new Response(upstream.body, { headers })
}
