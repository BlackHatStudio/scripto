import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function EmailSignaturesPage() {
  return (
    <PageLayout title="HTML Signatures" subtitle="Sanitized HTML signatures with plain-text fallback">
      <Card>
        <CardHeader>
          <CardTitle>Signature editor</CardTitle>
          <CardDescription>Unsafe scripts are blocked before rendering or saving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="text-white">Alex Morgan</p>
            <p>Elevated Dynamics</p>
            <p>alex@elevateddynamics.com</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">HTML</Badge>
            <Badge variant="secondary">Plain text fallback</Badge>
            <Badge variant="success">Sanitized</Badge>
          </div>
          <Button variant="outline">Edit signature</Button>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
