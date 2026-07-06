import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const templates = [
  { spoken: "new badge request for amy", output: "New badge request for {{name}}", scope: "personal" },
  { spoken: "send follow up email", output: "Please draft a follow-up email to {{recipient}}", scope: "shared" },
]

export default function PhraseTemplatesPage() {
  return (
    <PageLayout title="Phrase Templates" subtitle="Reusable spoken phrases that map to structured output">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Templates</CardTitle>
              <CardDescription>Variables are preserved for later expansion by the formatter.</CardDescription>
            </div>
            <Button variant="outline">Add template</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <div key={template.spoken} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Badge variant="outline">{template.scope}</Badge>
              <p className="mt-3 text-sm text-slate-400">Spoken</p>
              <p className="font-medium text-white">{template.spoken}</p>
              <p className="mt-3 text-sm text-slate-400">Output</p>
              <p className="font-medium text-white">{template.output}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
