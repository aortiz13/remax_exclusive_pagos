import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const YOUTUBE_API_KEY = "AIzaSyBvqhP6e8zyPgCAd9wFsDVAWgwVA7vZcak"
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""

const PLAYLISTS = [
    { id: 'PLd3VhBafUdLqaetc6gyid5PQ7c90yOAkZ', category: 'capacitaciones' },
    { id: 'PLd3VhBafUdLpMneYpy2hoJA7PbS_zqBwJ', category: 'tutoriales' },
    { id: 'PLpeYfCtXoij-ZMyQux4zYo8YTLw_kqZHD', category: 'aprendamos_tecnologia' }
]

const parseDuration = (duration: string) => {
    if (!duration) return '0:00';
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '0:00';
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

serve(async (req) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        let addedCount = 0
        let removedCount = 0

        // 1. Fetch current status from DB
        const { data: dbVideos } = await supabase
            .from('virtual_classroom_videos')
            .select('id, youtube_id, category')
            .in('category', PLAYLISTS.map(p => p.category))

        const dbVideosMap = Object.fromEntries(
            (dbVideos || []).filter(v => v.youtube_id).map(v => [v.youtube_id, v])
        )

        for (const playlist of PLAYLISTS) {
            // Fetch playlist items
            const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlist.id}&key=${YOUTUBE_API_KEY}`)
            const data = await res.json()

            if (!res.ok) throw new Error(`YouTube API Error: ${data.error?.message}`)

            const items = data.items.filter((item: any) =>
                item.snippet.title !== 'Private video' &&
                item.snippet.title !== 'Deleted video'
            )

            const ytIds = new Set(items.map((v: any) => v.snippet.resourceId.videoId))

            // Fetch durations
            const videoIds = Array.from(ytIds).join(',')
            const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`)
            const vData = await vRes.json()
            const durationsMap = Object.fromEntries(
                (vData.items || []).map((v: any) => [v.id, parseDuration(v.contentDetails.duration)])
            )

            // 2. Addition logic
            for (const item of items) {
                const youtubeId = item.snippet.resourceId.videoId
                if (!dbVideosMap[youtubeId]) {
                    await supabase.from('virtual_classroom_videos').insert({
                        title: item.snippet.title,
                        video_url: `https://www.youtube.com/watch?v=${youtubeId}`,
                        thumbnail_url: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
                        description: item.snippet.description,
                        category: playlist.category,
                        duration: durationsMap[youtubeId] || '0:00',
                        youtube_id: youtubeId
                    })
                    addedCount++
                }
            }

            // 3. Deletion logic
            const videosToRemove = (dbVideos || []).filter(v => v.category === playlist.category && !ytIds.has(v.youtube_id))
            if (videosToRemove.length > 0) {
                const idsToRemove = videosToRemove.map(v => v.id)
                await supabase.from('virtual_classroom_videos').delete().in('id', idsToRemove)
                removedCount += idsToRemove.length
            }
        }

        return new Response(JSON.stringify({
            success: true,
            added: addedCount,
            removed: removedCount
        }), {
            headers: { "Content-Type": "application/json" },
        })

    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
})
