import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const functions = [
  { name: "Plain dictation", type: "plain", trigger: "default", scope: "system", priority: 100 },
  { name: "Professional email", type: "email", trigger: "send an email", scope: "tenant", priority: 80 },
  { name: "Meeting notes", type: "meeting_notes", trigger: "meeting notes", scope: "shared", priority: 75 },
]

export default function VoiceFunctionsPage() {
  return (
    <PageLayout title="Voice Functions" subtitle="User and tenant-shared functions with explicit trigger phrases">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Functions</CardTitle>
              <CardDescription>Functions can target email, lists, prompts, notes, and custom workflows.</CardDescription>
            </div>
            <Button variant="outline">Create function</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {functions.map((item) => (
            <div key={item.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{item.scope}</Badge>
                <Badge variant="secondary">{item.type}</Badge>
                <Badge variant="success">Priority {item.priority}</Badge>
              </div>
              <p className="mt-3 font-medium text-white">{item.name}</p>
              <p className="text-sm text-slate-400">Trigger: {item.trigger}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
