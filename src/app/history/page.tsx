import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const history = [
  { date: "2026-05-03 08:45", mode: "Email", raw: "send follow up email", accepted: "modified" },
  { date: "2026-05-03 08:30", mode: "Plain", raw: "asap review with amy", accepted: "accepted" },
]

export default function HistoryPage() {
  return (
    <PageLayout title="Correction History" subtitle="Optional history is controlled by tenant and user settings">
      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>Sessions show raw transcript, corrected output, and feedback state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.map((item) => (
            <div key={item.date} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{item.date}</Badge>
                <Badge variant="secondary">{item.mode}</Badge>
                <Badge variant="success">{item.accepted}</Badge>
              </div>
              <p className="mt-3 text-sm text-slate-300">{item.raw}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
