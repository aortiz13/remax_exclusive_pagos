import { useEffect } from 'react';

const ChatwootWidget = () => {
    useEffect(() => {
        // Add Chatwoot Settings
        window.chatwootSettings = {
            hideMessageBubble: false,
            position: 'right', // This can be left or right
            locale: 'es', // Language to be set
            type: 'standard', // [standard, expanded_bubble]
        };

        // Paste the script from inbox settings except the <script> tags
        (function (d, t) {
            var BASE_URL = "https://wssp.remax-exclusive.cl";
            var g = d.createElement(t), s = d.getElementsByTagName(t)[0];
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
    }, []);

    return null;
};

export default ChatwootWidget;
