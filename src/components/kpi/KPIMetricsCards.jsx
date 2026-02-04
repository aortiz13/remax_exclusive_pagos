
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
            description: metrics.billingTrend ? `${metrics.billingTrend > 0 ? '+' : ''}${metrics.billingTrend.toFixed(1)}% vs anterior` : "Ingresos totales",
            trend: metrics.billingTrend > 0 ? "up" : metrics.billingTrend < 0 ? "down" : "neutral"
        },
        {
            title: "Ticket Promedio",
            value: formatCurrency(metrics.avgTicket),
            icon: Activity,
            description: metrics.ticketTrend ? `${metrics.ticketTrend > 0 ? '+' : ''}${metrics.ticketTrend.toFixed(1)}% vs anterior` : "Promedio por cierre",
            trend: metrics.ticketTrend > 0 ? "up" : metrics.ticketTrend < 0 ? "down" : "neutral"
        },
        {
            title: "Conv. Entrevista > Cap",
            value: `${(metrics.conversionRate || 0).toFixed(1)}%`,
            icon: Percent,
            description: metrics.conversionTrend ? `${metrics.conversionTrend > 0 ? '+' : ''}${metrics.conversionTrend.toFixed(1)}% vs anterior` : "Meta: > 40%",
            trend: metrics.conversionRate > 40 ? "up" : "neutral"
        },
        {
            title: "Agentes Activos",
            value: metrics.activeAgents || 0,
            icon: Users,
            description: metrics.agentsTrend ? `${metrics.agentsTrend > 0 ? '+' : ''}${metrics.agentsTrend.toFixed(1)}% vs anterior` : "Con actividad últ. 30 días",
            trend: metrics.agentsTrend > 0 ? "up" : metrics.agentsTrend < 0 ? "down" : "neutral"
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
