
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { ArrowDownRight, ArrowUpRight, DollarSign, Activity, Users, Percent } from 'lucide-react'

export function KPIMetricsCards({ metrics }) {
    // metrics: { totalBilling, avgTicket, conversionRate, activeAgents, ... }

    const formatCurrency = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val || 0)
    const formatPercent = (val) => `${(val || 0).toFixed(1)}%`

    const getTrendItem = (value, delta, label, showComp) => {
        if (!showComp) return { trend: 'neutral', desc: label }
        const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'
        const sign = delta > 0 ? '+' : ''
        return { trend, desc: `${sign}${delta.toFixed(1)}% vs periodo anterior` }
    }

    const billingTrend = getTrendItem(metrics.totalBilling, metrics.billingDelta, "Ingresos totales", metrics.showComparison)
    const ticketTrend = getTrendItem(metrics.avgTicket, metrics.ticketDelta, "Promedio por cierre", metrics.showComparison)
    const agentTrend = getTrendItem(metrics.activeAgents, metrics.agentsDelta, "Con actividad reciente", metrics.showComparison)
    const convTrend = getTrendItem(metrics.conversionRate, metrics.conversionDelta, "Meta: > 40%", metrics.showComparison)

    const items = [
        {
            title: "Facturación Total",
            value: formatCurrency(metrics.totalBilling),
            icon: DollarSign,
            description: billingTrend.desc,
            trend: billingTrend.trend
        },
        {
            title: "Ticket Promedio",
            value: formatCurrency(metrics.avgTicket),
            icon: Activity,
            description: ticketTrend.desc,
            trend: ticketTrend.trend
        },
        {
            title: "Conv. Entrevista > Cap",
            value: formatPercent(metrics.conversionRate),
            icon: Percent,
            description: convTrend.desc,
            trend: convTrend.trend
        },
        {
            title: "Agentes Activos",
            value: metrics.activeAgents || 0,
            icon: Users,
            description: agentTrend.desc,
            trend: agentTrend.trend
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
