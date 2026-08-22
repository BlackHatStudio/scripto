import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const members = [
  { name: "Alex Morgan", email: "alex@elevateddynamics.com", role: "TenantOwner", status: "active" },
  { name: "Dana Chen", email: "dana@elevateddynamics.com", role: "Manager", status: "active" },
]

export default function UsersPage() {
  return (
    <PageLayout title="Users & Roles" subtitle="Tenant memberships and role assignment are permission based">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>Invite placeholder is acceptable for MVP, but role changes are visible.</CardDescription>
            </div>
            <Button variant="outline">Invite member</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div key={member.email} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="font-medium text-white">{member.name}</p>
                <p className="text-sm text-slate-400">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{member.role}</Badge>
                <Badge variant="success">{member.status}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
