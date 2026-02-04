
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

export function ActivityScatterPlot({ data = [] }) {
    // Data: { name: 'Agent Name', effort: 50, result: 2, score: 100 }
    // Score = Effort * Result or custom metric

    // Calculate domain for Z axis to normalize sizes
    const zMax = Math.max(...data.map(d => d.score || 0), 10)

    return (
        <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                    type="number"
                    dataKey="effort"
                    name="Esfuerzo (Actividades)"
                    unit=""
                    fontSize={12}
                    label={{ value: 'Esfuerzo (Actividades)', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#64748b' }}
                />
                <YAxis
                    type="number"
                    dataKey="result"
                    name="Resultados (Cierres/Cap)"
                    unit=""
                    fontSize={12}
                    label={{ value: 'Resultados (Negocios)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#64748b' }}
                />
                <ZAxis type="number" dataKey="score" range={[60, 400]} name="Score" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                            <div className="bg-white p-3 border border-slate-200 shadow-md rounded-lg text-xs z-50">
                                <p className="font-bold text-slate-800 mb-1">{data.name}</p>
                                <div className="space-y-1 text-slate-600">
                                    <p>Esfuerzo: <span className="font-semibold text-blue-600">{data.effort}</span></p>
                                    <p>Resultados: <span className="font-semibold text-green-600">{data.result}</span></p>
                                    <p>Performance Score: <span className="font-semibold">{data.score}</span></p>
                                </div>
                            </div>
                        )
                    }
                    return null
                }} />
                <Scatter name="Agentes" data={data} fill="#8884d8">
                    {data.map((entry, index) => {
                        // Top Performer logic: High Result AND High Effort (or just high Result?)
                        // User said "Start size proportional to effort vs result to identify top performers"
                        // Let's assume Top Performer is top 20% score? Or absolute threshold?
                        // Let's use color differentiation based on result/effort ratio or absolute result
                        const isTop = entry.result >= 4; // Absolute threshold example
                        return <Cell key={`cell-${index}`} fill={isTop ? '#16a34a' : '#6366f1'} />
                    })}
                </Scatter>
            </ScatterChart>
        </ResponsiveContainer>
    )
}

export function StockTrendChart({ data = [] }) {
    // Data: { name: 'Sem 1', stock: 50, new: 5, sold: 3 }
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="stock" name="Cartera Activa" stroke="#8884d8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="new" name="Entradas (Cap)" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sold" name="Salidas (Ventas)" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
        </ResponsiveContainer>
    )
}
