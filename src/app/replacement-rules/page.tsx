import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const rules = [
  { trigger: "ASAP", replacement: "as soon as possible", type: "exact", scope: "shared", priority: 90 },
  { trigger: "follow-up", replacement: "follow up", type: "phrase", scope: "personal", priority: 70 },
  { trigger: "^recap$", replacement: "meeting recap", type: "regex", scope: "tenant", priority: 60 },
]

export default function ReplacementRulesPage() {
  return (
    <PageLayout title="Replacement Rules" subtitle="Exact, phrase, fuzzy, phonetic, and safe regex rules">
      <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create rule</CardTitle>
            <CardDescription>Rules are ordered by priority and scoped by ownership.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Trigger text" />
            <Input placeholder="Replacement text" />
            <Select defaultValue="personal">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["personal", "shared", "tenant"].map((scope) => (
                  <SelectItem key={scope} value={scope}>{scope}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue="exact">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["exact", "phrase", "fuzzy", "phonetic", "regex"].map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Priority" defaultValue="50" />
            <Textarea placeholder="Notes" />
            <Button className="w-full">Save rule</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
            <CardDescription>Tenant-safe regex should be explicitly marked safe before use.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.trigger} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{rule.scope}</Badge>
                  <Badge variant="secondary">{rule.type}</Badge>
                  <Badge variant="success">Priority {rule.priority}</Badge>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  <span className="font-medium text-white">{rule.trigger}</span> → {rule.replacement}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
