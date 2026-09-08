import { BriefcaseBusiness, FileText, ReceiptText } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type LeadRelatedLinksProps = {
  leadId: string
  counts: {
    proposals: number
    projects: number
    invoices: number
  }
}

export function LeadRelatedLinks({ leadId, counts }: LeadRelatedLinksProps) {
  const links = [
    { href: `/proposals?lead=${leadId}`, icon: FileText, label: 'Propuestas', count: counts.proposals },
    { href: `/projects?lead=${leadId}`, icon: BriefcaseBusiness, label: 'Proyectos', count: counts.projects },
    { href: `/invoices?lead=${leadId}`, icon: ReceiptText, label: 'Facturas', count: counts.invoices },
  ]

  return (
    <Card>
      <CardHeader className="border-border/70 bg-muted/10 border-b">
        <CardTitle className="text-base">Accesos relacionados</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 pt-5 sm:grid-cols-3">
        {links.map(({ href, icon: Icon, label, count }) => (
          <Button key={label} asChild variant="outline" className="h-auto justify-between px-3 py-2.5">
            <Link href={href}>
              <span className="flex items-center gap-2">
                <Icon className="size-4" />
                {label}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}