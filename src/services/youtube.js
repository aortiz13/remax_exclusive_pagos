const API_KEY = 'AIzaSyBvqhP6e8zyPgCAd9wFsDVAWgwVA7vZcak';

const parseDuration = (duration) => {
    if (!duration) return '0:00';
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const fetchVideoMetadata = async (url) => {
    try {
        let videoId = '';

        // Extract Video ID
        if (url.includes('youtu.be')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/watch')) {
            const urlParams = new URLSearchParams(new URL(url).search);
            videoId = urlParams.get('v');
        } else if (url.includes('youtube.com/embed/')) {
            videoId = url.split('youtube.com/embed/')[1].split('?')[0];
        }

        if (!videoId) {
            throw new Error('URL de YouTube no válida');
        }

        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${API_KEY}`);

        if (!response.ok) {
            throw new Error('Error al conectar con YouTube API');
        }

        const data = await response.json();

        if (data.items.length === 0) {
            throw new Error('Video no encontrado');
        }

        const item = data.items[0];
        const snippet = item.snippet;
        const contentDetails = item.contentDetails;

        return {
            title: snippet.title,
            thumbnail_url: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url,
            video_url: `https://www.youtube.com/watch?v=${videoId}`,
            embed_url: `https://www.youtube.com/embed/${videoId}`,
            description: snippet.description,
            duration: parseDuration(contentDetails.duration)
        };

    } catch (error) {
        console.error("Error fetching YouTube metadata:", error);
        throw error;
    }
};

export const fetchPlaylistItems = async (playlistId) => {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${API_KEY}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Error fetching playlist items');
        }

        const items = data.items.filter(item => item.snippet.title !== 'Private video' && item.snippet.title !== 'Deleted video');

        // Fetch durations
        const videoIds = items.map(item => item.snippet.resourceId.videoId).join(',');
        const videosResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${API_KEY}`);
        const videosData = await videosResponse.json();
        const videosMap = {};
        if (videosData.items) {
            videosData.items.forEach(v => {
                videosMap[v.id] = parseDuration(v.contentDetails.duration);
            });
        }

        return items.map(item => ({
            youtube_id: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            thumbnail_url: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
            video_url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
            description: item.snippet.description,
            publishedAt: item.snippet.publishedAt,
            duration: videosMap[item.snippet.resourceId.videoId] || '0:00'
        }));
    } catch (error) {
        console.error("Error fetching playlist items:", error);
        throw error;
    }
};
