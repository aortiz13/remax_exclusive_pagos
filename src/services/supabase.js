
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wdyfeolbuogoyngrvxkc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWZlb2xidW9nb3luZ3J2eGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODIyMTUsImV4cCI6MjA4NDA1ODIxNX0.6wOgw7h9ZsnKIpkqYE7faXUlNHHdhSo7bIHMEdvIN1Y'

export const supabase = createClient(supabaseUrl, supabaseKey)

export const getCustomPublicUrl = (bucket, path) => {
    if (!path) return null
    // Use custom domain for storage URLs as requested by user
    return `https://solicitudes.remax-exclusive.cl/storage/v1/object/public/${bucket}/${path}`
}
