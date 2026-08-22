import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const events = [
  { action: "user.created", subject: "Alex Morgan", scope: "Auth" },
  { action: "dictionary.term.created", subject: "Scripto", scope: "Dictionary" },
  { action: "voice_function.updated", subject: "Meeting notes", scope: "Functions" },
]

export default function AuditPage() {
  return (
    <PageLayout title="Audit Log" subtitle="Security, admin, and dictionary/function events">
      <Card>
        <CardHeader>
          <CardTitle>Audit events</CardTitle>
          <CardDescription>Visible to tenant admins and auditors with audit.read permission.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.map((event) => (
            <div key={event.action} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{event.scope}</Badge>
                <Badge variant="secondary">{event.action}</Badge>
              </div>
              <p className="mt-3 text-sm text-slate-300">{event.subject}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
