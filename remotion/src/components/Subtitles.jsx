import { useCurrentFrame, interpolate } from 'remotion';

/**
 * Dynamic subtitle overlay
 * - With wordMap: highlights current word synced with TTS timestamps
 * - Without wordMap: shows full narration text as subtitle
 */
export const Subtitles = ({ segments, fps }) => {
    const frame = useCurrentFrame();
    const currentTimeSeconds = frame / fps;

    // Find the active segment
    const activeSegment = segments.find(
        (s) =>
            currentTimeSeconds >= (s.startTime || 0) &&
            (s.endTime ? currentTimeSeconds < s.endTime : true)
    );

    if (!activeSegment) return null;

    // Check for word-level alignment data
    const wordMap = activeSegment?.alignmentData?.wordMap || activeSegment?.wordMap;
    const hasWordMap = wordMap && wordMap.length > 0;

    // Segment transition animation
    const segStart = activeSegment.startTime || 0;
    const localFrame = (currentTimeSeconds - segStart) * fps;
    const fadeIn = interpolate(localFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 60,
                left: '50%',
                transform: 'translateX(-50%)',
                maxWidth: '80%',
                textAlign: 'center',
                opacity: fadeIn,
            }}
        >
            <div
                style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 12,
                    padding: '12px 24px',
                    display: 'inline-block',
                }}
            >
                {hasWordMap ? (
                    <WordHighlightSubtitle
                        wordMap={wordMap}
                        segmentOffset={segStart}
                        currentTimeSeconds={currentTimeSeconds}
                    />
                ) : (
                    <SimpleSubtitle text={activeSegment.narrationText || activeSegment.narration_text || ''} />
                )}
            </div>

            {/* Segment label */}
            {activeSegment.label && (
                <div
                    style={{
                        marginTop: 8,
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.5)',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontWeight: 500,
                    }}
                >
                    {activeSegment.label}
                </div>
            )}
        </div>
    );
};

/**
 * Simple subtitle — just shows the full narration text
 */
const SimpleSubtitle = ({ text }) => (
    <span
        style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 24,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: '0.01em',
        }}
    >
        {text}
    </span>
);

/**
 * Word-highlight subtitle — highlights the active word
 */
const WordHighlightSubtitle = ({ wordMap, segmentOffset, currentTimeSeconds }) => {
    const localTime = currentTimeSeconds - segmentOffset;

    let currentWordIndex = 0;
    for (let i = 0; i < wordMap.length; i++) {
        if (wordMap[i].time <= localTime) {
            currentWordIndex = i;
        }
    }

    const windowSize = 4;
    const startIdx = Math.max(0, currentWordIndex - windowSize);
    const endIdx = Math.min(wordMap.length - 1, currentWordIndex + windowSize);
    const visibleWords = wordMap.slice(startIdx, endIdx + 1);

    return (
        <span
            style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 28,
                lineHeight: 1.5,
                color: 'white',
                letterSpacing: '0.02em',
            }}
        >
            {visibleWords.map((w, i) => {
                const globalIndex = startIdx + i;
                const isActive = globalIndex === currentWordIndex;
                return (
                    <span
                        key={i}
                        style={{
                            color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.9)',
                            fontWeight: isActive ? 700 : 400,
                        }}
                    >
                        {w.word}{' '}
                    </span>
                );
            })}
        </span>
    );
};
