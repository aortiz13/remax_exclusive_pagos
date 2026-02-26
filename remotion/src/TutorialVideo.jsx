import {
    AbsoluteFill,
    Audio,
    Img,
    OffthreadVideo,
    Sequence,
    interpolate,
    useCurrentFrame,
    useVideoConfig,
    staticFile,
} from 'remotion';
import { Subtitles } from './components/Subtitles';
import { IntroSlide } from './components/IntroSlide';

const DEFAULT_BRANDING = {
    logo: 'https://res.cloudinary.com/dhzmkxbek/image/upload/v1770205777/Globo_REMAX_sin_fondo_PNG_xiqr1a.png',
    primaryColor: '#003DA5',
    secondaryColor: '#DC1E35',
};

/**
 * Main TutorialVideo composition
 * Combines: intro → screen recording with narration audio + subtitles → outro
 */
export const TutorialVideo = ({
    title,
    description,
    recordingUrl,
    segments = [],
    branding: brandingProp,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const branding = { ...DEFAULT_BRANDING, ...(brandingProp || {}) };

    const INTRO_DURATION_FRAMES = fps * 4; // 4 second intro
    const OUTRO_DURATION_FRAMES = fps * 3; // 3 second outro

    // Calculate total content duration from segments
    const lastSegment = segments[segments.length - 1];
    const contentDurationSeconds = lastSegment?.endTime || (lastSegment?.startTime || 0) + 30 || 60;
    const contentDurationFrames = Math.ceil(contentDurationSeconds * fps);

    return (
        <AbsoluteFill style={{ backgroundColor: '#0f172a' }}>
            {/* ── Intro Slide ── */}
            <Sequence durationInFrames={INTRO_DURATION_FRAMES}>
                <IntroSlide title={title} description={description} branding={branding} />
            </Sequence>

            {/* ── Main Content: Recording + Audio + Subtitles ── */}
            <Sequence from={INTRO_DURATION_FRAMES} durationInFrames={contentDurationFrames}>
                <AbsoluteFill>
                    {/* Background: recording video OR animated gradient */}
                    {recordingUrl ? (
                        <OffthreadVideo
                            src={recordingUrl}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    ) : (
                        <ContentBackground
                            frame={frame - INTRO_DURATION_FRAMES}
                            fps={fps}
                            branding={branding}
                            segments={segments}
                        />
                    )}

                    {/* Audio tracks per segment */}
                    {segments.map((segment, i) => {
                        if (!segment.audioUrl) return null;
                        const startFrame = Math.floor((segment.startTime || 0) * fps);
                        return (
                            <Sequence key={i} from={startFrame}>
                                <Audio src={segment.audioUrl} volume={1} />
                            </Sequence>
                        );
                    })}

                    {/* Subtitle overlay */}
                    <Subtitles segments={segments} fps={fps} />

                    {/* Branding watermark */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 20,
                            right: 20,
                            opacity: 0.5,
                        }}
                    >
                        <Img
                            src={branding.logo}
                            style={{ height: 36 }}
                        />
                    </div>
                </AbsoluteFill>
            </Sequence>

            {/* ── Outro Slide ── */}
            <Sequence
                from={INTRO_DURATION_FRAMES + contentDurationFrames}
                durationInFrames={OUTRO_DURATION_FRAMES}
            >
                <AbsoluteFill
                    style={{
                        background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 20,
                    }}
                >
                    <Img src={branding.logo} style={{ height: 80 }} />
                    <div
                        style={{
                            color: 'white',
                            fontSize: 32,
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontWeight: 700,
                            opacity: interpolate(
                                frame - INTRO_DURATION_FRAMES - contentDurationFrames,
                                [0, 15],
                                [0, 1],
                                { extrapolateRight: 'clamp' }
                            ),
                        }}
                    >
                        RE/MAX Exclusive
                    </div>
                    <div
                        style={{
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: 18,
                            fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                    >
                        Workspace CRM
                    </div>
                </AbsoluteFill>
            </Sequence>
        </AbsoluteFill>
    );
};

/**
 * ContentBackground: animated background when no screen recording is provided
 * Shows segment labels, a progress bar, and narration text with nice visuals
 */
const ContentBackground = ({ frame, fps, branding, segments }) => {
    const currentTimeSeconds = frame / fps;

    // Find current segment
    const activeSegment = segments.find(
        (s) =>
            currentTimeSeconds >= (s.startTime || 0) &&
            (s.endTime ? currentTimeSeconds < s.endTime : true)
    );

    const activeIndex = segments.findIndex(
        (s) =>
            currentTimeSeconds >= (s.startTime || 0) &&
            (s.endTime ? currentTimeSeconds < s.endTime : true)
    );

    // Progress within segment
    const segStart = activeSegment?.startTime || 0;
    const segEnd = activeSegment?.endTime || segStart + 10;
    const segProgress = Math.min(1, (currentTimeSeconds - segStart) / (segEnd - segStart));

    // Entrance animation
    const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill
            style={{
                background: `linear-gradient(160deg, #0f172a 0%, #1e293b 50%, ${branding.primaryColor}22 100%)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 80,
                opacity: fadeIn,
            }}
        >
            {/* Step indicator */}
            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 40,
                }}
            >
                {segments.map((s, i) => (
                    <div
                        key={i}
                        style={{
                            width: i === activeIndex ? 48 : 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: i === activeIndex
                                ? branding.primaryColor
                                : i < activeIndex
                                    ? `${branding.primaryColor}80`
                                    : 'rgba(255,255,255,0.15)',
                            transition: 'all 0.3s',
                        }}
                    />
                ))}
            </div>

            {/* Step number */}
            <div
                style={{
                    fontSize: 18,
                    color: branding.primaryColor,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 16,
                }}
            >
                Paso {activeIndex + 1} de {segments.length}
            </div>

            {/* Segment label */}
            <div
                style={{
                    fontSize: 52,
                    color: 'white',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: 800,
                    textAlign: 'center',
                    maxWidth: '80%',
                    lineHeight: 1.2,
                    marginBottom: 30,
                    opacity: interpolate(
                        (currentTimeSeconds - segStart) * fps,
                        [0, 10],
                        [0, 1],
                        { extrapolateRight: 'clamp' }
                    ),
                }}
            >
                {activeSegment?.label || ''}
            </div>

            {/* Narration text */}
            <div
                style={{
                    fontSize: 24,
                    color: 'rgba(255,255,255,0.7)',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: 400,
                    textAlign: 'center',
                    maxWidth: '70%',
                    lineHeight: 1.6,
                    opacity: interpolate(
                        (currentTimeSeconds - segStart) * fps,
                        [5, 20],
                        [0, 1],
                        { extrapolateRight: 'clamp' }
                    ),
                }}
            >
                {activeSegment?.narrationText || ''}
            </div>

            {/* Progress bar */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 40,
                    left: 80,
                    right: 80,
                    height: 4,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 2,
                }}
            >
                <div
                    style={{
                        width: `${segProgress * 100}%`,
                        height: '100%',
                        backgroundColor: branding.primaryColor,
                        borderRadius: 2,
                        transition: 'width 0.1s',
                    }}
                />
            </div>
        </AbsoluteFill>
    );
};
