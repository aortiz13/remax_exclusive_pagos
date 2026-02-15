-- Create agent_folders table
CREATE TABLE IF NOT EXISTS public.agent_folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.agent_folders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agent_files table
CREATE TABLE IF NOT EXISTS public.agent_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.agent_folders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_files ENABLE ROW LEVEL SECURITY;

-- Policies for agent_folders
CREATE POLICY "Users can view their own folders"
ON public.agent_folders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders"
ON public.agent_folders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
ON public.agent_folders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
ON public.agent_folders FOR DELETE
USING (auth.uid() = user_id);

-- Policies for agent_files
CREATE POLICY "Users can view their own files"
ON public.agent_files FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
ON public.agent_files FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files"
ON public.agent_files FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
ON public.agent_files FOR DELETE
USING (auth.uid() = user_id);


-- Create storage bucket 'agent_documents' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent_documents', 'agent_documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage objects in 'agent_documents'
-- We assume a structure like: user_id/filename.ext or user_id/folder_id/filename.ext
-- But for simplicity and security, we can just enforce that the user owns the object.
-- Supabase storage policies usually check auth.uid() against the owner of the object or path.

-- Allow users to upload to their own folder (root of bucket/user_id/...)
CREATE POLICY "Agents can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'agent_documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Agents can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'agent_documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Agents can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'agent_documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
