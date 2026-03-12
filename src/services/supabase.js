
import { createClient } from '@supabase/supabase-js'

// Self-hosted API Gateway (GoTrue + PostgREST + MinIO)
const supabaseUrl = 'https://remax-crm-remax-app.jzuuqr.easypanel.host'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWZlb2xidW9nb3luZ3J2eGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODIyMTUsImV4cCI6MjA4NDA1ODIxNX0.6wOgw7h9ZsnKIpkqYE7faXUlNHHdhSo7bIHMEdvIN1Y'

export const supabase = createClient(supabaseUrl, supabaseKey)

// MinIO public URL for file access
const STORAGE_PUBLIC_URL = 'https://remax-crm-remax-storage.jzuuqr.easypanel.host'

export const getCustomPublicUrl = (bucket, path) => {
    if (!path) return null
    return `${STORAGE_PUBLIC_URL}/${bucket}/${path}`
}
