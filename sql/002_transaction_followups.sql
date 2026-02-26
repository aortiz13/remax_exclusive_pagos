-- Transaction Followups table: reminds agents at 1mo, 6mo, 1yr after sale/rental completion
CREATE TABLE IF NOT EXISTS public.transaction_followups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('venta','arriendo')),
  milestone TEXT NOT NULL CHECK (milestone IN ('1month','6months','1year')),
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','dismissed')),
  buyer_contact_id UUID REFERENCES public.contacts(id),
  seller_contact_id UUID REFERENCES public.contacts(id),
  property_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.transaction_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage own followups" ON public.transaction_followups
  FOR ALL USING (agent_id = auth.uid());

CREATE POLICY "Admin full access followups" ON public.transaction_followups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','commercial','legal'))
  );

-- Index
CREATE INDEX idx_transaction_followups_agent_status ON public.transaction_followups(agent_id, status);
CREATE INDEX idx_transaction_followups_due_date ON public.transaction_followups(due_date);
