import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const profiles = [
  { name: "Default Professional", email: "alex@elevateddynamics.com", tone: "professional", enabled: true },
  { name: "Support", email: "support@northwind.com", tone: "friendly", enabled: true },
]

export default function EmailProfilesPage() {
  return (
    <PageLayout title="Email Profiles" subtitle="Profiles can be personal or shared and attach signatures">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Email profiles</CardTitle>
              <CardDescription>Configure greeting, closing, tone, and signature assignment.</CardDescription>
            </div>
            <Button variant="outline">Create profile</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {profiles.map((profile) => (
            <div key={profile.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{profile.tone}</Badge>
                <Badge variant={profile.enabled ? "success" : "secondary"}>{profile.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
              <p className="mt-3 font-medium text-white">{profile.name}</p>
              <p className="text-sm text-slate-400">{profile.email}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
