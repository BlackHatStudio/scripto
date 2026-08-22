import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const devices = [
  { name: "Chrome on MacBook Pro", lastSeen: "2026-05-03 08:21", version: "12" },
  { name: "Edge on Windows", lastSeen: "2026-05-02 19:10", version: "11" },
]

export default function DevicesPage() {
  return (
    <PageLayout title="Device Sessions" subtitle="Track sessions and revoke refresh access">
      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
          <CardDescription>Local dictionary sync endpoints are prepared for future encrypted cache support.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.map((device) => (
            <div key={device.name} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="font-medium text-white">{device.name}</p>
                <p className="text-sm text-slate-400">Last seen {device.lastSeen}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Dictionary v{device.version}</Badge>
                <Button variant="outline">Revoke</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
