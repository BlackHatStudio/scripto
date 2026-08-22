import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const terms = [
  { correctText: "Northwind Health", spokenForm: "northwind health", active: true, scope: "Tenant" },
  { correctText: "Customer Success", spokenForm: "customer success", active: true, scope: "Tenant" },
  { correctText: "SLA", spokenForm: "s l a", active: false, scope: "Tenant" },
]

export default function SharedDictionaryPage() {
  return (
    <PageLayout title="Shared Dictionary" subtitle="Tenant-wide terms visible to all members with read access">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Shared terms</CardTitle>
              <CardDescription>Tenant admins can manage active and inactive shared terms.</CardDescription>
            </div>
            <Button variant="outline">Manage sharing settings</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-3">Correct text</th>
                  <th className="px-4 py-3">Spoken form</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={term.correctText} className="border-t border-white/10">
                    <td className="px-4 py-3 font-medium">{term.correctText}</td>
                    <td className="px-4 py-3 text-slate-400">{term.spokenForm}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{term.scope}</Badge></td>
                    <td className="px-4 py-3">
                      <Badge variant={term.active ? "success" : "secondary"}>{term.active ? "Active" : "Inactive"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
