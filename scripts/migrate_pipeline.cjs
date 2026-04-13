const { Client } = require('pg')

const SQL = `
-- 1) Add new columns to recruitment_candidates
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS prefilter_date timestamptz;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS prefilter_notes text;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS prefilter_approved boolean;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS prefilter_meet_link text;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS form_token text;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS form_sent_at timestamptz;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS cv_uploaded_at timestamptz;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS meeting_type text DEFAULT 'presencial';
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS payment_link text;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS payment_amount numeric;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pendiente';
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS payment_date timestamptz;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS whatsapp_video_sent boolean DEFAULT false;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS lost_reason text;

-- 2) Create recruitment_stage_actions table
CREATE TABLE IF NOT EXISTS recruitment_stage_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id text NOT NULL,
  action_order integer NOT NULL DEFAULT 0,
  action_type text NOT NULL,
  config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3) Create recruitment_funnel_snapshots table
CREATE TABLE IF NOT EXISTS recruitment_funnel_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  stage text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  source text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funnel_date ON recruitment_funnel_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_funnel_stage ON recruitment_funnel_snapshots(stage);

-- 4) Unique index on form_token (partial, non-null only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rc_form_token ON recruitment_candidates(form_token) WHERE form_token IS NOT NULL;

-- 5) Migrate existing candidates from old stages to new
UPDATE recruitment_candidates SET pipeline_stage = 'nuevo_lead' WHERE pipeline_stage = 'Nuevo';
UPDATE recruitment_candidates SET pipeline_stage = 'contacto_inicial' WHERE pipeline_stage IN ('Reunión Agendada');
UPDATE recruitment_candidates SET pipeline_stage = 'pre_filtro' WHERE pipeline_stage IN ('Reunión Confirmada');
UPDATE recruitment_candidates SET pipeline_stage = 'reunion_presencial' WHERE pipeline_stage = 'Aprobado';
UPDATE recruitment_candidates SET pipeline_stage = 'perdido' WHERE pipeline_stage IN ('Desaprobado', 'Perdido');
UPDATE recruitment_candidates SET pipeline_stage = 'ganado' WHERE pipeline_stage = 'Ganado';
UPDATE recruitment_candidates SET pipeline_stage = 'seguimiento' WHERE pipeline_stage = 'Seguimiento';

-- 6) Update pipeline history references
UPDATE recruitment_pipeline_history SET to_stage = 'nuevo_lead' WHERE to_stage = 'Nuevo';
UPDATE recruitment_pipeline_history SET from_stage = 'nuevo_lead' WHERE from_stage = 'Nuevo';
UPDATE recruitment_pipeline_history SET to_stage = 'contacto_inicial' WHERE to_stage = 'Reunión Agendada';
UPDATE recruitment_pipeline_history SET from_stage = 'contacto_inicial' WHERE from_stage = 'Reunión Agendada';
UPDATE recruitment_pipeline_history SET to_stage = 'pre_filtro' WHERE to_stage = 'Reunión Confirmada';
UPDATE recruitment_pipeline_history SET from_stage = 'pre_filtro' WHERE from_stage = 'Reunión Confirmada';
UPDATE recruitment_pipeline_history SET to_stage = 'reunion_presencial' WHERE to_stage = 'Aprobado';
UPDATE recruitment_pipeline_history SET from_stage = 'reunion_presencial' WHERE from_stage = 'Aprobado';
UPDATE recruitment_pipeline_history SET to_stage = 'perdido' WHERE to_stage IN ('Desaprobado', 'Perdido');
UPDATE recruitment_pipeline_history SET from_stage = 'perdido' WHERE from_stage IN ('Desaprobado', 'Perdido');
UPDATE recruitment_pipeline_history SET to_stage = 'ganado' WHERE to_stage = 'Ganado';
UPDATE recruitment_pipeline_history SET from_stage = 'ganado' WHERE from_stage = 'Ganado';
UPDATE recruitment_pipeline_history SET to_stage = 'seguimiento' WHERE to_stage = 'Seguimiento';
UPDATE recruitment_pipeline_history SET from_stage = 'seguimiento' WHERE from_stage = 'Seguimiento';
`

const SEED_ACTIONS = `
INSERT INTO recruitment_stage_actions (stage_id, action_order, action_type, config) VALUES
  ('contacto_inicial', 1, 'email', '{"template": "email_ab_test", "description": "Enviar email A/B de bienvenida"}'),
  ('contacto_inicial', 2, 'whatsapp_video', '{"description": "Enviar video WhatsApp de presentacion"}'),
  ('pre_filtro', 1, 'task', '{"task_type": "Reunion", "title": "Agendar pre-filtro Meet 10min", "description": "Invitar a Google Meet para pre-filtro con Karen"}'),
  ('formulario_cv', 1, 'form_link', '{"description": "Enviar email con link al formulario nativo y CV"}'),
  ('reunion_presencial', 1, 'task', '{"task_type": "Reunion", "title": "Agendar reunion presencial 60min", "description": "Reunion con Broker martes o jueves"}'),
  ('cierre_comercial', 1, 'payment_link', '{"description": "Generar y enviar link de pago inmediato"}'),
  ('ganado', 1, 'email', '{"template": "bienvenida_agente", "description": "Enviar email de bienvenida al nuevo agente"}')
ON CONFLICT DO NOTHING;
`

async function run() {
  const c = new Client('postgres://postgres:5a58ca9a00e2837be764@panel.remax-exclusive.cl:5432/postgres?sslmode=disable')
  await c.connect()
  try {
    await c.query(SQL)
    console.log('✅ Schema migration done')
    await c.query(SEED_ACTIONS)
    console.log('✅ Stage actions seeded')
    
    // Verify
    const res = await c.query("SELECT pipeline_stage, count(*) as total FROM recruitment_candidates GROUP BY pipeline_stage ORDER BY total DESC")
    console.log('📊 Current pipeline distribution:', JSON.stringify(res.rows, null, 2))
  } catch (err) {
    console.error('❌ Migration error:', err.message)
  }
  await c.end()
}

run()
