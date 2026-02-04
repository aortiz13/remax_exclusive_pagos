
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { ArrowDownRight, ArrowUpRight, DollarSign, Activity, Users, Percent } from 'lucide-react'

export function KPIMetricsCards({ metrics }) {
    // metrics: { totalBilling, avgTicket, conversionRate, activeAgents, ... }

    const formatCurrency = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val || 0)

    const items = [
        {
            title: "Facturación Total",
            value: formatCurrency(metrics.totalBilling),
            icon: DollarSign,
            description: "+20.1% vs mes anterior",
            trend: "up"
        },
        {
            title: "Ticket Promedio",
            value: formatCurrency(metrics.avgTicket),
            icon: Activity,
            description: "Promedio por cierre",
            trend: "neutral"
        },
        {
            title: "Conv. Entrevista > Cap",
            value: `${(metrics.conversionRate || 0).toFixed(1)}%`,
            icon: Percent,
            description: "Meta: > 40%",
            trend: (metrics.conversionRate || 0) > 40 ? "up" : "down"
        },
        {
            title: "Agentes Activos",
            value: metrics.activeAgents || 0,
            icon: Users,
            description: "Con actividad últ. 30 días",
            trend: "up"
        }
    ]

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {items.map((item, index) => (
                <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {item.title}
                        </CardTitle>
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{item.value}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            {item.trend === 'up' && <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />}
                            {item.trend === 'down' && <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />}
                            {item.description}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
