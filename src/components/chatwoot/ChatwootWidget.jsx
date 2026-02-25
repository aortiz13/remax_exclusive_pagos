import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const ChatwootWidget = () => {
    const { user, profile, loading } = useAuth();

    // Hidden for guests (no user) or admins
    // We wait for loading to be false to avoid flickering or showing it briefly before role is known
    const shouldHide = loading || !user || profile?.role === 'superadministrador';

    useEffect(() => {
        // If it should be hidden, ensure it's hidden and don't load the script if not needed
        if (shouldHide) {
            if (window.$chatwoot) {
                window.$chatwoot.toggle('hide');
            }
            return;
        }

        // Add Chatwoot Settings
        window.chatwootSettings = {
            hideMessageBubble: false,
            position: 'right', // This can be left or right
            locale: 'es', // Language to be set
            type: 'standard', // [standard, expanded_bubble]
        };

        // Check if script already exists to avoid duplicate loading
        const existingScript = document.getElementById('chatwoot-sdk');

        if (!existingScript) {
            (function (d, t) {
                var BASE_URL = "https://wssp.remax-exclusive.cl";
                var g = d.createElement(t), s = d.getElementsByTagName(t)[0];
                g.id = 'chatwoot-sdk';
                g.src = BASE_URL + "/packs/js/sdk.js";
                g.defer = true;
                g.async = true;
                s.parentNode.insertBefore(g, s);
                g.onload = function () {
                    window.chatwootSDK.run({
                        websiteToken: '52McBJxcBUNkQP8fJmgnoHcV',
                        baseUrl: BASE_URL
                    })
                }
            })(document, "script");
        } else if (window.$chatwoot) {
            // If already loaded but was hidden, show it
            window.$chatwoot.toggle('show');
        }

        // Cleanup: hide widget when component unmounts or state changes
        return () => {
            if (window.$chatwoot) {
                window.$chatwoot.toggle('hide');
            }
        };
    }, [shouldHide]);

    return null;
};

export default ChatwootWidget;
