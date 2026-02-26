import { Composition } from 'remotion';
import { TutorialVideo } from './TutorialVideo';

export const RemotionRoot = () => {
    return (
        <Composition
            id="TutorialVideo"
            component={TutorialVideo}
            durationInFrames={30 * 60} // Default 60 seconds, overridden by props
            fps={30}
            width={1920}
            height={1080}
            defaultProps={{
                title: 'Tutorial CRM Remax Exclusive',
                description: '',
                recordingUrl: '',
                segments: [],
                branding: {
                    logo: 'https://res.cloudinary.com/dhzmkxbek/image/upload/v1770205777/Globo_REMAX_sin_fondo_PNG_xiqr1a.png',
                    primaryColor: '#003DA5',
                    secondaryColor: '#DC1E35',
                },
            }}
        />
    );
};
