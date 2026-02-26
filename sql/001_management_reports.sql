-- Management Reports table: tracks 15-day periodic reports agents must send to property owners
CREATE TABLE IF NOT EXISTS public.management_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  mandate_id UUID REFERENCES public.mandates(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  report_number INT NOT NULL DEFAULT 1,
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','overdue')),
  -- Report data following the template format
  report_data JSONB DEFAULT '{
    "portales": {
      "remax": {"visitas": null, "contactos": null, "visitas_realizadas": null},
      "portal_inmobiliario": {"visitas": null, "contactos": null, "visitas_coordinadas": null},
      "proppit": {"impresiones": null, "visitas": null, "contactos": null},
      "yapo": {"impresiones": null, "visitas": null, "contactos": null}
    },
    "actividades": "",
    "analisis_mercado": "",
    "conclusiones": ""
  }',
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.management_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage own reports" ON public.management_reports
  FOR ALL USING (agent_id = auth.uid());

CREATE POLICY "Admin full access reports" ON public.management_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','commercial','legal'))
  );

-- Index for fast lookups
CREATE INDEX idx_management_reports_agent_status ON public.management_reports(agent_id, status);
CREATE INDEX idx_management_reports_due_date ON public.management_reports(due_date);
