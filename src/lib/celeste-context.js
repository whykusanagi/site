/**
 * Celeste AI Context Manager
 * Integrates page context awareness with Celeste AI agent
 * Tracks which page the user is on and sends context to backend
 */

class CelesteContextManager {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.contextLoaded = false;
        this.currentPageContext = null;
        this.contextualPrompt = null;
        this.suggestedQueries = [];
    }

    /**
     * Initialize context manager on page load
     */
    async initialize() {
        try {
            // Get the current page context
            this.currentPageContext = this.getPageContext();

            // Send context to backend for processing
            await this.sendContextToBackend();

            this.contextLoaded = true;
        } catch (error) {
            console.error('❌ Failed to initialize Celeste context:', error);
            // Continue anyway with default context
            this.contextualPrompt = this.getDefaultPrompt();
        }
    }

    /**
     * Get context information about the current page
     */
    getPageContext() {
        const path = window.location.pathname;
        const pageType = this.detectPageType(path);

        const context = {
            page: pageType,
            path: path,
            timestamp: new Date().toISOString(),
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            userAgent: navigator.userAgent,
            referrer: document.referrer
        };

        // Add page-specific data
        switch (pageType) {
            case 'home':
                context.data = {
                    purpose: 'Main portfolio landing page',
                    sections: ['Art', 'Celeste AI', 'Doujinshi', 'Character References', 'Links', 'Tools'],
                    suggestions: [
                        'Show me your art portfolio',
                        'Tell me about Celeste AI',
                        'What tools do you offer?',
                        'Where can I find your social media?'
                    ]
                };
                break;

            case 'art':
                context.data = {
                    purpose: 'Digital art gallery and portfolio',
                    features: ['Art gallery', 'Filtering by tags', 'Lightbox preview'],
                    suggestions: [
                        'What is your artistic style?',
                        'Do you take commissions?',
                        'Can you explain this artwork?',
                        'What software do you use?'
                    ]
                };
                break;

            case 'celeste':
                context.data = {
                    purpose: 'Celeste AI character information page',
                    features: ['Character profile', 'AI personality info', 'Interaction examples'],
                    suggestions: [
                        'Who is Celeste AI?',
                        'What is your personality like?',
                        'How do you help?',
                        'Tell me a joke'
                    ]
                };
                break;

            case 'references':
                context.data = {
                    purpose: 'Character reference sheets and design materials',
                    features: ['Reference gallery', 'Character designs', 'Artistic references'],
                    suggestions: [
                        'Explain the character designs',
                        'What is the character anatomy?',
                        'Show me the color palette',
                        'Are these commissions available?'
                    ]
                };
                break;

            case 'doujin':
                context.data = {
                    purpose: 'Manga/Doujinshi projects showcase',
                    features: ['Manga pages', 'Story information', 'Purchase links'],
                    suggestions: [
                        'What are your manga projects?',
                        'Where can I read the full story?',
                        'Can I purchase this?',
                        'Tell me about the plot'
                    ]
                };
                break;

            case 'links':
                context.data = {
                    purpose: 'Social media and external links aggregator',
                    features: ['Social links', 'Platform profiles', 'Community links'],
                    suggestions: [
                        'Where can I follow you?',
                        'Do you have a Discord?',
                        'Link to your streams?',
                        'How do I contact you?'
                    ]
                };
                break;

            case 'tools':
                context.data = {
                    purpose: 'Software tools and utility calculators',
                    features: ['Boss HP calculator', 'Raid planners', 'Countdown timers'],
                    suggestions: [
                        'How do I use this calculator?',
                        'What data can I input?',
                        'How accurate are these results?',
                        'Can I export the data?'
                    ]
                };
                break;

            case 'privacy':
                context.data = {
                    purpose: 'Privacy policy and legal information',
                    features: ['Terms', 'Data policies', 'Contact information'],
                    suggestions: [
                        'What data do you collect?',
                        'How is my data used?',
                        'What are your terms of service?',
                        'How do I contact you?'
                    ]
                };
                break;

            default:
                context.data = {
                    purpose: 'whykusanagi portfolio website',
                    features: ['Art portfolio', 'Character information', 'Tools', 'Community links'],
                    suggestions: [
                        'What is this website?',
                        'Tell me about your projects',
                        'How can I support you?',
                        'Can you help me with something?'
                    ]
                };
        }

        return context;
    }

    /**
     * Detect page type from URL path
     */
    detectPageType(path) {
        // Normalize path
        path = path.toLowerCase();

        if (path === '/' || path === '/index.html') return 'home';
        if (path.includes('art')) return 'art';
        if (path.includes('celeste')) return 'celeste';
        if (path.includes('reference')) return 'references';
        if (path.includes('kirara') || path.includes('bastard') || path.includes('doujin')) return 'doujin';
        if (path.includes('link')) return 'links';
        if (path.includes('tool') || path.includes('calc') || path.includes('countdown')) return 'tools';
        if (path.includes('privacy')) return 'privacy';

        return 'unknown';
    }

    /**
     * Send context to backend API
     */
    async sendContextToBackend() {
        try {
            // Check if API is available (won't fail if not)
            const contextData = {
                page_context: this.currentPageContext,
                session_id: this.sessionId,
                timestamp: new Date().toISOString()
            };

            // Try to send to backend (non-critical)
            try {
                const response = await fetch('/api/celeste/context', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(contextData),
                    timeout: 5000 // 5 second timeout
                });

                if (response.ok) {
                    const result = await response.json();
                    this.contextualPrompt = result.contextual_prompt;
                    this.suggestedQueries = result.suggested_queries || [];
                    return;
                }
            } catch (fetchError) {
                // Backend not available, will use default
                console.warn('⚠️ Backend API not available, using default context');
            }

            // Fallback to default prompt if backend unavailable
            this.contextualPrompt = this.getDefaultPrompt();
        } catch (error) {
            console.error('❌ Error sending context to backend:', error);
            this.contextualPrompt = this.getDefaultPrompt();
        }
    }

    /**
     * Get default contextual prompt based on page
     */
    getDefaultPrompt() {
        const pageType = this.currentPageContext?.page || 'unknown';
        const prompts = {
            'home': "Hello! I'm Celeste, your AI assistant for the whykusanagi portfolio. I can help you explore the art gallery, learn about my character, find tools, or connect on social media. What would you like to know?",

            'art': "Hello! I'm Celeste, here to help you explore the art gallery. I can discuss artistic styles, commission information, and provide context about the artworks. What interests you?",

            'celeste': "Hello! I'm Celeste AI, the chaotic Onee-san assistant. Ask me anything about who I am, my personality, my relationship with whykusanagi, or what I do. What's on your mind?",

            'references': "Hello! I'm here to help explain character designs and reference materials. I can discuss anatomy, color palettes, design inspiration, and artistic techniques. What would you like to know?",

            'doujin': "Hello! I'm Celeste, here to guide you through the manga projects. I can tell you about storylines, characters, where to read, and how to purchase. What interests you?",

            'links': "Hello! I'm here to help you find and connect on social media. I can point you to Twitch, Twitter, Discord, YouTube, and other platforms where you can follow whykusanagi. How can I help?",

            'tools': "Hello! I'm Celeste, ready to help you use the available tools. I can explain how the calculators work, what data to input, and how to interpret results. What tool do you need help with?",

            'privacy': "Hello! I'm here to help explain privacy policies and legal information. I can clarify data practices, terms of service, and contact information. What do you need to know?",

            'default': "Hello, I am CelesteAI. Is there something I can help you with or are you just gonna stare?"
        };

        return prompts[pageType] || prompts.default;
    }

    /**
     * Get contextual prompt for use with Celeste widget
     */
    getContextualPrompt() {
        return this.contextualPrompt || this.getDefaultPrompt();
    }

    /**
     * Get suggested queries for current page
     */
    getSuggestedQueries() {
        return this.suggestedQueries || this.currentPageContext?.data?.suggestions || [];
    }

    /**
     * Update context when page changes (for SPA)
     */
    async updateContext() {
        this.currentPageContext = this.getPageContext();
        await this.sendContextToBackend();
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'fallback_' + Date.now();
        return 'celeste_' + uuid;
    }

    /**
     * Log context information (for debugging)
     */
    logContext() {
        console.group('🎭 Celeste Context Information');
        console.info('Session ID:', this.sessionId);
        console.info('Current Page:', this.currentPageContext);
        console.info('Contextual Prompt:', this.contextualPrompt);
        console.info('Suggested Queries:', this.suggestedQueries);
        console.groupEnd();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Don't initialize on privacy/policy pages
    if (window.location.pathname.includes('privacy')) {
        return;
    }

    const celesteContext = new CelesteContextManager();
    celesteContext.initialize();

    // Make globally available
    window.celesteContext = celesteContext;

    // Log for debugging (remove in production)
    if (window.location.hash === '#debug-celeste') {
        celesteContext.logContext();
    }
});

// Update context on page navigation (for SPAs)
window.addEventListener('popstate', () => {
    if (window.celesteContext) {
        window.celesteContext.updateContext();
    }
});

// Listen for history changes (manual navigation)
const originalPushState = window.history.pushState;
window.history.pushState = function(...args) {
    if (window.celesteContext) {
        setTimeout(() => window.celesteContext.updateContext(), 0);
    }
    return originalPushState.apply(this, args);
};
