-- Add missing RLS policies for email synchronization
-- This allows agents to insert and update their own threads and messages

-- 1. email_threads
CREATE POLICY "Agents can insert their own email threads"
ON public.email_threads
FOR INSERT
TO public
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can update their own email threads"
ON public.email_threads
FOR UPDATE
TO public
USING (auth.uid() = agent_id)
WITH CHECK (auth.uid() = agent_id);

-- 2. email_messages
CREATE POLICY "Agents can insert their own email messages"
ON public.email_messages
FOR INSERT
TO public
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can update their own email messages"
ON public.email_messages
FOR UPDATE
TO public
USING (auth.uid() = agent_id)
WITH CHECK (auth.uid() = agent_id);
