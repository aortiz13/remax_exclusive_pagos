
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    ScatterChart,
    Scatter,
    ZAxis
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

const CustomTooltip = ({ active, payload, label, formatter }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs">
                <p className="font-bold text-slate-700 mb-1">{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.color }}>
                        {entry.name}: {formatter ? formatter(entry.value) : entry.value}
                    </p>
                ))}
            </div>
        )
    }
    return null
}

const currencyFormatter = (value) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value)

export function BillingVsGoalChart({ data = [] }) {
    // Data expected: { name: 'Ene', billing: 5000000, goal: 4000000 }
    return (
        <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val / 1000000}M`}
                />
                <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} />
                <Legend />
                <Area type="monotone" dataKey="billing" name="Facturado" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="goal" name="Meta" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </ComposedChart>
        </ResponsiveContainer>
    )
}

import { ComposedChart } from 'recharts'

export function ConversionFunnelChart({ data = [] }) {
    // Data: { name: 'Step', value: 100 }
    // Steps: Conversaciones -> Entrevistas -> Captaciones -> Cierres
    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                <Bar dataKey="value" name="Cantidad" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={30}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}

// Scatter Plot: Esfuerzo vs Resultado (Enhanced)
export function ActivityScatterPlot({ data }) {
    return (
        <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                    type="number"
                    dataKey="effort"
                    name="Esfuerzo (Actividades)"
                    label={{ value: 'Esfuerzo (Actividades)', position: 'bottom', offset: 0 }}
                />
                <YAxis
                    type="number"
                    dataKey="result"
                    name="Resultado (Captaciones/Ventas)"
                    label={{ value: 'Resultado (Cierres)', angle: -90, position: 'left' }}
                />
                <ZAxis type="number" dataKey="efficiency" range={[50, 400]} name="Eficiencia" />
                <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                                <div className="bg-white p-3 border rounded shadow-lg text-xs">
                                    <p className="font-bold">{data.name}</p>
                                    <p>Esfuerzo: {data.effort}</p>
                                    <p>Resultado: {data.result}</p>
                                    <p>Eficiencia: {data.efficiency ? data.efficiency.toFixed(2) : 0}</p>
                                </div>
                            );
                        }
                        return null;
                    }}
                />
                <Legend />
                <Scatter name="Agentes" data={data} fill="#8884d8">
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.efficiency > 1.5 ? '#22c55e' : entry.efficiency < 0.5 ? '#ef4444' : '#3b82f6'} />
                    ))}
                </Scatter>
            </ScatterChart>
        </ResponsiveContainer>
    )
}

// Funnel: Captación
export function CaptationFunnelChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" hide />
                <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                    tick={{ fontSize: 12 }}
                />
                <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30}>
                    <LabelList dataKey="value" position="right" fill="#64748b" fontSize={12} />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}

// Funnel: Venta
export function SalesFunnelChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" hide />
                <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                    tick={{ fontSize: 12 }}
                />
                <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={30}>
                    <LabelList dataKey="value" position="right" fill="#64748b" fontSize={12} />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}

// Stock Trend Chart
export function StockTrendChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="stock" stroke="#8884d8" fillOpacity={1} fill="url(#colorStock)" name="Cartera Activa" />
                <Area type="monotone" dataKey="sales" stroke="#82ca9d" fillOpacity={1} fill="url(#colorSales)" name="Ventas" />
            </AreaChart>
        </ResponsiveContainer>
    )
}
