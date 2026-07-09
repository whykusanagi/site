/**
 * Reusable WHYKUSANAGI Logo Component
 *
 * Standardized logo with womb tattoo background icon used across:
 * - gaming-overlay.html
 * - break-overlay.html
 * - stream-ending-overlay.html
 *
 * Usage:
 *   import { LogoComponent } from './components/logo-component.js';
 *   const logo = new LogoComponent(container, options);
 *   logo.show();
 */

export class LogoComponent {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            position: options.position || 'top-left', // 'top-left', 'top-right', 'center'
            size: options.size || 'normal', // 'small', 'normal', 'large'
            showSubtitle: options.showSubtitle !== false, // default true
            subtitle: options.subtitle || 'CORRUPTED STREAM',
            wombTattooOpacity: options.wombTattooOpacity || 0.85, // High visibility
            animation: options.animation || 'fade-in', // 'fade-in', 'slide-in', 'none'
            zIndex: options.zIndex || 250
        };

        this.element = null;
        this.styleSheet = null;
        this.create();
    }

    create() {
        // Inject keyframe animation if not already present
        this.injectStyles();

        // Create main logo container
        this.element = document.createElement('div');
        this.element.id = 'logo-banner';
        this.element.className = 'whykusanagi-logo';

        // Apply size-specific dimensions
        const sizes = {
            small: { width: '350px', height: '80px', fontSize: '24px', subtitleSize: '9px', tattooSize: '70px', tattooMargin: '80px' },
            normal: { width: '500px', height: '120px', fontSize: '36px', subtitleSize: '11px', tattooSize: '100px', tattooMargin: '110px' },
            large: { width: '650px', height: '150px', fontSize: '48px', subtitleSize: '14px', tattooSize: '130px', tattooMargin: '140px' }
        };

        const size = sizes[this.options.size];

        // Apply styles
        Object.assign(this.element.style, {
            position: 'absolute',
            width: size.width,
            height: size.height,
            zIndex: this.options.zIndex,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            opacity: this.options.animation === 'none' ? '1' : '0',
            transition: 'opacity 0.5s ease'
        });

        // Position
        this.setPosition(this.options.position);

        // Create womb tattoo icon (to the LEFT of text)
        const tattoo = document.createElement('div');
        tattoo.className = 'womb-tattoo-icon';
        Object.assign(tattoo.style, {
            position: 'absolute',
            top: '50%',
            left: '0',
            transform: 'translateY(-50%)',
            width: size.tattooSize,
            height: size.tattooSize,
            backgroundImage: 'url(https://s3.whykusanagi.xyz/tools/thumbnail-generator/assets/Womb_Tattoo.png)',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: 'contain',
            opacity: this.options.wombTattooOpacity,
            zIndex: '1',
            pointerEvents: 'none',
            animation: 'logoTattooGlow 4s ease-in-out infinite'
        });

        // Create text container
        const textContainer = document.createElement('div');
        textContainer.className = 'logo-text-container';
        Object.assign(textContainer.style, {
            position: 'relative',
            marginLeft: size.tattooMargin,
            zIndex: '1'
        });

        // Create main text
        const mainText = document.createElement('div');
        mainText.className = 'logo-text';
        mainText.textContent = 'WHYKUSANAGI';
        Object.assign(mainText.style, {
            fontSize: size.fontSize,
            fontWeight: 'bold',
            color: '#00ffff',
            textShadow: `
                0 0 8px rgba(0, 255, 255, 0.8),
                0 0 15px rgba(0, 255, 255, 0.6),
                0 0 25px rgba(139, 92, 246, 0.4)
            `,
            letterSpacing: '6px',
            fontFamily: "'Courier New', monospace",
            textTransform: 'uppercase',
            whiteSpace: 'nowrap'
        });

        // Create subtitle if enabled
        if (this.options.showSubtitle) {
            const subtitle = document.createElement('div');
            subtitle.className = 'logo-subtitle';
            subtitle.textContent = this.options.subtitle;
            Object.assign(subtitle.style, {
                position: 'absolute',
                bottom: '-5px',
                left: '0',
                fontSize: size.subtitleSize,
                color: '#d94f90',
                textShadow: '0 0 8px rgba(217, 79, 144, 0.6)',
                letterSpacing: '2px',
                fontFamily: "'Courier New', monospace",
                opacity: '0.7',
                whiteSpace: 'nowrap'
            });

            textContainer.appendChild(mainText);
            textContainer.appendChild(subtitle);
        } else {
            textContainer.appendChild(mainText);
        }

        // Assemble
        this.element.appendChild(tattoo);
        this.element.appendChild(textContainer);

        // Add to container
        this.container.appendChild(this.element);
    }

    injectStyles() {
        // Only inject once
        if (document.getElementById('logo-component-styles')) return;

        const style = document.createElement('style');
        style.id = 'logo-component-styles';
        style.textContent = `
            @keyframes logoTattooGlow {
                0%, 100% {
                    filter:
                        drop-shadow(0 0 8px rgba(217, 79, 144, 1))
                        drop-shadow(0 0 15px rgba(217, 79, 144, 0.8))
                        drop-shadow(0 0 25px rgba(139, 92, 246, 0.6))
                        brightness(1.2);
                }
                50% {
                    filter:
                        drop-shadow(0 0 12px rgba(217, 79, 144, 1))
                        drop-shadow(0 0 20px rgba(217, 79, 144, 0.9))
                        drop-shadow(0 0 35px rgba(139, 92, 246, 0.8))
                        brightness(1.4);
                }
            }
        `;
        document.head.appendChild(style);
        this.styleSheet = style;
    }

    setPosition(position) {
        // Reset all position properties
        this.element.style.top = '';
        this.element.style.bottom = '';
        this.element.style.left = '';
        this.element.style.right = '';
        this.element.style.transform = '';

        switch (position) {
            case 'top-left':
                this.element.style.top = '20px';
                this.element.style.left = '20px';
                break;
            case 'top-right':
                this.element.style.top = '20px';
                this.element.style.right = '20px';
                break;
            case 'top-center':
                this.element.style.top = '20px';
                this.element.style.left = '50%';
                this.element.style.transform = 'translateX(-50%)';
                break;
            case 'center':
                this.element.style.top = '50%';
                this.element.style.left = '50%';
                this.element.style.transform = 'translate(-50%, -50%)';
                break;
            case 'bottom-left':
                this.element.style.bottom = '20px';
                this.element.style.left = '20px';
                break;
            case 'bottom-right':
                this.element.style.bottom = '20px';
                this.element.style.right = '20px';
                break;
            default:
                this.element.style.top = '20px';
                this.element.style.left = '20px';
        }
    }

    show() {
        if (this.options.animation === 'fade-in') {
            setTimeout(() => {
                this.element.style.opacity = '0.8';
            }, 100);
        } else if (this.options.animation === 'slide-in') {
            this.element.style.opacity = '0.8';
            this.element.style.transform += ' translateX(-20px)';
            setTimeout(() => {
                this.element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                this.element.style.transform = this.element.style.transform.replace('translateX(-20px)', 'translateX(0)');
            }, 100);
        } else {
            this.element.style.opacity = '0.8';
        }
    }

    hide() {
        this.element.style.opacity = '0';
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
