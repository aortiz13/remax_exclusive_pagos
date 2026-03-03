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

/**
 * Fetches ALL items from a YouTube playlist, paginating through all pages.
 * YouTube API returns max 50 items per page via `nextPageToken`.
 */
async function fetchAllPlaylistItems(playlistId: string) {
    const allItems: any[] = [];
    let nextPageToken = '';

    do {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(`YouTube API Error: ${data.error?.message}`);
        }

        allItems.push(...(data.items || []));
        nextPageToken = data.nextPageToken || '';
    } while (nextPageToken);

    // Filter out private/deleted videos
    return allItems.filter((item: any) =>
        item.snippet.title !== 'Private video' &&
        item.snippet.title !== 'Deleted video'
    );
}

/**
 * Fetches durations for a list of video IDs, chunking in batches of 50
 * (YouTube videos.list API also has a 50 ID limit per request).
 */
async function fetchDurationsMap(videoIds: string[]) {
    const durationsMap: Record<string, string> = {};

    for (let i = 0; i < videoIds.length; i += 50) {
        const chunk = videoIds.slice(i, i + 50);
        const idsParam = chunk.join(',');

        if (!idsParam) continue;

        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${idsParam}&key=${YOUTUBE_API_KEY}`);
        const data = await res.json();

        if (data.items) {
            data.items.forEach((v: any) => {
                durationsMap[v.id] = parseDuration(v.contentDetails.duration);
            });
        }
    }

    return durationsMap;
}

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
            // Fetch ALL playlist items with pagination
            const items = await fetchAllPlaylistItems(playlist.id)

            const ytIds = new Set(items.map((v: any) => v.snippet.resourceId.videoId))
            const videoIdsList = Array.from(ytIds) as string[]

            console.log(`[Sync] Playlist ${playlist.category}: ${videoIdsList.length} videos from YouTube`)

            // Fetch durations in chunks of 50
            const durationsMap = await fetchDurationsMap(videoIdsList)

            // 2. Addition logic — insert new videos not yet in DB
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
                        youtube_id: youtubeId,
                        video_date: item.snippet.publishedAt
                    })
                    addedCount++
                }
            }

            // 3. Deletion logic — remove from DB if no longer in YouTube playlist
            const videosToRemove = (dbVideos || []).filter(v => v.category === playlist.category && !ytIds.has(v.youtube_id))
            if (videosToRemove.length > 0) {
                const idsToRemove = videosToRemove.map(v => v.id)
                await supabase.from('virtual_classroom_videos').delete().in('id', idsToRemove)
                removedCount += idsToRemove.length
            }
        }

        console.log(`[Sync] Complete: +${addedCount} added, -${removedCount} removed`)

        return new Response(JSON.stringify({
            success: true,
            added: addedCount,
            removed: removedCount
        }), {
            headers: { "Content-Type": "application/json" },
        })

    } catch (error) {
        console.error('[Sync] Error:', error)
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
})
