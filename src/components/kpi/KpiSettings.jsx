import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input } from '@/components/ui'
import { Save } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { toast } from 'sonner'

export function KpiSettings({ settings, onUpdate }) {
    const [targets, setTargets] = useState({
        monthly_billing_goal: 5000000,
        daily_conversations: 10,
        weekly_prelisting: 2,
        weekly_prebuying: 1,
        monthly_captures: 4,
        monthly_closing: 1
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (settings?.value) {
            setTargets(prev => ({ ...prev, ...settings.value }))
        } else if (settings?.monthly_billing_goal) {
            // Handle case where settings might be flattened or different structure
            // But based on previous code, it seems it was stored in key='default_targets' value={...}
            // Or top level? Current plan assumes 'kpi_settings' table has key/value.
        }
    }, [settings])

    const handleTargetChange = (name, val) => {
        setTargets(prev => ({ ...prev, [name]: parseInt(val) || 0 }))
    }

    const saveSettings = async () => {
        setSaving(true)
        try {
            const { error } = await supabase
                .from('kpi_settings')
                .upsert({
                    key: 'default_targets',
                    value: targets
                }, { onConflict: 'key' })

            if (error) throw error
            toast.success('Configuración guardada')
            if (onUpdate) onUpdate()
        } catch (e) {
            console.error(e)
            toast.error('Error al guardar configuración')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración de Metas Globales</CardTitle>
                <CardDescription>
                    Estos valores se utilizan como referencia para las barras de progreso y cálculos de cumplimiento.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Meta Facturación Mensual (Por Agente)</label>
                        <Input
                            type="number"
                            value={targets.monthly_billing_goal}
                            onChange={(e) => handleTargetChange('monthly_billing_goal', e.target.value)}
                        />
                        <p className="text-xs text-slate-400">Objetivo base para cálculo de cumplimiento ($)</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Inicios Conversación (Diario)</label>
                        <Input
                            type="number"
                            value={targets.daily_conversations}
                            onChange={(e) => handleTargetChange('daily_conversations', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Reuniones Pre-listing (Semanal)</label>
                        <Input
                            type="number"
                            value={targets.weekly_prelisting}
                            onChange={(e) => handleTargetChange('weekly_prelisting', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Reuniones Pre-buying (Semanal)</label>
                        <Input
                            type="number"
                            value={targets.weekly_prebuying}
                            onChange={(e) => handleTargetChange('weekly_prebuying', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Captaciones (Mensual)</label>
                        <Input
                            type="number"
                            value={targets.monthly_captures}
                            onChange={(e) => handleTargetChange('monthly_captures', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Cierres de Negocio (Mensual)</label>
                        <Input
                            type="number"
                            value={targets.monthly_closing}
                            onChange={(e) => handleTargetChange('monthly_closing', e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <Button onClick={saveSettings} disabled={saving} className="gap-2">
                        <Save className="w-4 h-4" />
                        {saving ? 'Guardando...' : 'Guardar Configuración'}
                    </Button>
                </div>

            </CardContent>
        </Card>
    )
}
