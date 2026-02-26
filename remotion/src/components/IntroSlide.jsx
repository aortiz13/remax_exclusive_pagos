import {
    AbsoluteFill,
    Img,
    interpolate,
    useCurrentFrame,
    useVideoConfig,
} from 'remotion';

/**
 * Branded intro slide with RE/MAX logo, title, and fade-in animation
 */
export const IntroSlide = ({ title, description, branding }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const logoScale = interpolate(frame, [0, 20], [0.5, 1], {
        extrapolateRight: 'clamp',
    });
    const logoOpacity = interpolate(frame, [0, 15], [0, 1], {
        extrapolateRight: 'clamp',
    });
    const titleOpacity = interpolate(frame, [15, 35], [0, 1], {
        extrapolateRight: 'clamp',
    });
    const titleY = interpolate(frame, [15, 35], [30, 0], {
        extrapolateRight: 'clamp',
    });
    const descOpacity = interpolate(frame, [30, 50], [0, 1], {
        extrapolateRight: 'clamp',
    });

    // Fade out at end
    const totalFrames = fps * 4;
    const fadeOut = interpolate(
        frame,
        [totalFrames - 20, totalFrames],
        [1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return (
        <AbsoluteFill
            style={{
                background: `linear-gradient(135deg, ${branding.primaryColor} 0%, #1e3a5f 50%, ${branding.secondaryColor} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 30,
                opacity: fadeOut,
            }}
        >
            {/* Decorative circles */}
            <div
                style={{
                    position: 'absolute',
                    top: -200,
                    right: -200,
                    width: 600,
                    height: 600,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: -100,
                    left: -100,
                    width: 400,
                    height: 400,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.03)',
                }}
            />

            {/* Logo */}
            <div
                style={{
                    opacity: logoOpacity,
                    transform: `scale(${logoScale})`,
                }}
            >
                <Img
                    src={branding.logo}
                    style={{
                        height: 120,
                        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))',
                    }}
                />
            </div>

            {/* Title */}
            <div
                style={{
                    opacity: titleOpacity,
                    transform: `translateY(${titleY}px)`,
                    textAlign: 'center',
                    maxWidth: '70%',
                }}
            >
                <h1
                    style={{
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: 56,
                        fontWeight: 800,
                        color: 'white',
                        lineHeight: 1.2,
                        textShadow: '0 2px 10px rgba(0,0,0,0.3)',
                        margin: 0,
                    }}
                >
                    {title}
                </h1>
            </div>

            {/* Description */}
            {description && (
                <div
                    style={{
                        opacity: descOpacity,
                        textAlign: 'center',
                        maxWidth: '60%',
                    }}
                >
                    <p
                        style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: 24,
                            color: 'rgba(255,255,255,0.7)',
                            lineHeight: 1.5,
                            margin: 0,
                        }}
                    >
                        {description}
                    </p>
                </div>
            )}

            {/* Bottom bar */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 40,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    opacity: descOpacity * 0.6,
                }}
            >
                <span
                    style={{
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: 16,
                        color: 'rgba(255,255,255,0.5)',
                        fontWeight: 500,
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                    }}
                >
                    RE/MAX Exclusive · Workspace CRM
                </span>
            </div>
        </AbsoluteFill>
    );
};
