import { Activity, MessagesSquare } from "lucide-react"

import { ConversationList } from "@/components/dashboard/conversation-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCalls, type CallSummary } from "@/lib/calls"

// Always render at request time so the dashboard reflects live data instead of
// being prerendered (with empty data) at build time when the DB is unreachable.
export const dynamic = "force-dynamic"

async function loadCalls(): Promise<CallSummary[]> {
  try {
    return await getCalls()
  } catch {
    return []
  }
}

export default async function Home() {
  const calls = await loadCalls()

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-10 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <MessagesSquare className="size-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Conversations
          </h1>
          <p className="text-sm text-muted-foreground">
            The calls currently working to fill open slots — and how recent
            conversations with waitlisted patients played out.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            Recent conversations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConversationList calls={calls} />
        </CardContent>
      </Card>
    </div>
  )
}
