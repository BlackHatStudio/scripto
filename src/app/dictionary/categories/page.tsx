import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const categories = [
  { name: "Names", scope: "System" },
  { name: "Company Names", scope: "Tenant" },
  { name: "Software Terms", scope: "User" },
  { name: "Access Control", scope: "Tenant" },
  { name: "Security Systems", scope: "System" },
  { name: "Acronyms", scope: "User" },
  { name: "Technical Terms", scope: "Tenant" },
  { name: "Custom Phrases", scope: "Tenant" },
]

export default function DictionaryCategoriesPage() {
  return (
    <PageLayout title="Dictionary Categories" subtitle="System, user, and tenant categories for organizing terms">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Category set</CardTitle>
              <CardDescription>Default categories are seeded for new tenants.</CardDescription>
            </div>
            <Button variant="outline">Add category</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {categories.map((category) => (
            <div key={category.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="font-medium text-white">{category.name}</div>
              <Badge variant="outline" className="mt-3">{category.scope}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
