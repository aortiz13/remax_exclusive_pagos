
const API_KEY = 'AIzaSyBvqhP6e8zyPgCAd9wFsDVAWgwVA7vZcak';

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

        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`);

        if (!response.ok) {
            throw new Error('Error al conectar con YouTube API');
        }

        const data = await response.json();

        if (data.items.length === 0) {
            throw new Error('Video no encontrado');
        }

        const snippet = data.items[0].snippet;

        return {
            title: snippet.title,
            thumbnail_url: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url,
            video_url: `https://www.youtube.com/watch?v=${videoId}`,
            embed_url: `https://www.youtube.com/embed/${videoId}`,
            description: snippet.description
        };

    } catch (error) {
        console.error("Error fetching YouTube metadata:", error);
        throw error;
    }
};
