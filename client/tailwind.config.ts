import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./node_modules/streamdown/dist/**/*.{js,mjs}"],
  theme: {
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			success: 'hsl(var(--success))',
  			warning: 'hsl(var(--warning))',
  			danger: 'hsl(var(--danger))',
  			'accent-glow': 'hsl(var(--accent-glow))',
  			'accent-glow-foreground': 'hsl(var(--accent-glow-foreground))',
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-sans)',
  				'system-ui',
  				'sans-serif'
  			],
  			display: [
  				'var(--font-sans)',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-mono)',
  				'monospace'
  			]
  		},
  		boxShadow: {
  			subtle: '0 1px 2px rgba(0, 0, 0, 0.04)',
  			card: '0 0 0 1px hsl(var(--border))',
  			elevated: '0 0 0 1px hsl(var(--border)), 0 8px 24px hsl(var(--primary) / 0.08)'
  		},
  		animation: {
  			'fade-in': 'fade-in 0.4s ease-out forwards',
  			'slide-up': 'slide-up 0.4s ease-out forwards',
  			'scroll-up': 'scroll-up 40s linear infinite',
  			'scroll-down': 'scroll-down 40s linear infinite',
  			'ambient-drift': 'ambient-drift 12s ease-in-out infinite',
  			'ambient-drift-reverse': 'ambient-drift-reverse 14s ease-in-out infinite',
  			'option-in': 'option-in 0.5s ease-out forwards',
  			'count-up': 'count-up 0.6s ease-out forwards',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'collapsible-down': 'collapsible-down 0.2s ease-out',
  			'collapsible-up': 'collapsible-up 0.2s ease-out',
  			typing: 'typing 1s infinite',
  			'loading-dots': 'loading-dots 1.4s infinite',
  			wave: 'wave 1s ease-in-out infinite',
  			blink: 'blink 1s step-end infinite',
  			'text-blink': 'text-blink 2s ease-in-out infinite',
  			'bounce-dots': 'bounce-dots 1.4s ease-in-out infinite',
  			'thin-pulse': 'thin-pulse 1.5s ease-in-out infinite',
  			'pulse-dot': 'pulse-dot 1.2s ease-in-out infinite',
  			shimmer: 'shimmer 4s infinite linear',
  			'wave-bars': 'wave-bars 1.2s ease-in-out infinite',
  			'spinner-fade': 'spinner-fade 1.2s linear infinite',
  			'hero-float': 'hero-float 5.5s ease-in-out infinite',
  			'hero-word-in': 'hero-word-in 0.65s ease-out forwards',
  			'hero-underline-draw': 'hero-underline-draw 0.9s ease-out 0.5s forwards',
  			'hero-card-pop': 'hero-card-pop 0.55s ease-out forwards',
  			'hero-option-pulse': 'hero-option-pulse 0.4s ease-out'
  		},
  		keyframes: {
  			'fade-in': {
  				from: {
  					opacity: '0'
  				},
  				to: {
  					opacity: '1'
  				}
  			},
  			'slide-up': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(6px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'scroll-up': {
  				from: {
  					transform: 'translateY(0)'
  				},
  				to: {
  					transform: 'translateY(-50%)'
  				}
  			},
  			'scroll-down': {
  				from: {
  					transform: 'translateY(-50%)'
  				},
  				to: {
  					transform: 'translateY(0)'
  				}
  			},
  			'ambient-drift': {
  				'0%, 100%': {
  					transform: 'translate(0, 0) scale(1)'
  				},
  				'50%': {
  					transform: 'translate(12px, -8px) scale(1.04)'
  				}
  			},
  			'ambient-drift-reverse': {
  				'0%, 100%': {
  					transform: 'translate(0, 0) scale(1)'
  				},
  				'50%': {
  					transform: 'translate(-10px, 10px) scale(1.03)'
  				}
  			},
  			'option-in': {
  				from: {
  					opacity: '0',
  					transform: 'translateX(-8px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateX(0)'
  				}
  			},
  			'count-up': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(6px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'hero-float': {
  				'0%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-7px)'
  				}
  			},
  			'hero-word-in': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(14px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'hero-underline-draw': {
  				from: {
  					strokeDashoffset: '420'
  				},
  				to: {
  					strokeDashoffset: '0'
  				}
  			},
  			'hero-card-pop': {
  				from: {
  					opacity: '0',
  					transform: 'scale(0.94) translateY(10px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'scale(1) translateY(0)'
  				}
  			},
  			'hero-option-pulse': {
  				'0%': {
  					transform: 'scale(1)'
  				},
  				'45%': {
  					transform: 'scale(1.012)'
  				},
  				'100%': {
  					transform: 'scale(1)'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'collapsible-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-collapsible-content-height)'
  				}
  			},
  			'collapsible-up': {
  				from: {
  					height: 'var(--radix-collapsible-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			typing: {
  				'0%, 100%': {
  					transform: 'translateY(0)',
  					opacity: '0.5'
  				},
  				'50%': {
  					transform: 'translateY(-2px)',
  					opacity: '1'
  				}
  			},
  			'loading-dots': {
  				'0%, 100%': {
  					opacity: '0'
  				},
  				'50%': {
  					opacity: '1'
  				}
  			},
  			wave: {
  				'0%, 100%': {
  					transform: 'scaleY(1)'
  				},
  				'50%': {
  					transform: 'scaleY(0.6)'
  				}
  			},
  			blink: {
  				'0%, 100%': {
  					opacity: '1'
  				},
  				'50%': {
  					opacity: '0'
  				}
  			},
  			'text-blink': {
  				'0%, 100%': {
  					color: 'hsl(var(--primary))'
  				},
  				'50%': {
  					color: 'hsl(var(--muted-foreground))'
  				}
  			},
  			'bounce-dots': {
  				'0%, 100%': {
  					transform: 'scale(0.8)',
  					opacity: '0.5'
  				},
  				'50%': {
  					transform: 'scale(1.2)',
  					opacity: '1'
  				}
  			},
  			'thin-pulse': {
  				'0%, 100%': {
  					transform: 'scale(0.95)',
  					opacity: '0.8'
  				},
  				'50%': {
  					transform: 'scale(1.05)',
  					opacity: '0.4'
  				}
  			},
  			'pulse-dot': {
  				'0%, 100%': {
  					transform: 'scale(1)',
  					opacity: '0.8'
  				},
  				'50%': {
  					transform: 'scale(1.5)',
  					opacity: '1'
  				}
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '200% 50%'
  				},
  				'100%': {
  					backgroundPosition: '-200% 50%'
  				}
  			},
  			'wave-bars': {
  				'0%, 100%': {
  					transform: 'scaleY(1)',
  					opacity: '0.5'
  				},
  				'50%': {
  					transform: 'scaleY(0.6)',
  					opacity: '1'
  				}
  			},
  			'spinner-fade': {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			}
  		},
  		fontSize: {
  			'display-lg': [
  				'4.5rem',
  				{
  					lineHeight: '1.05',
  					letterSpacing: '-0.03em',
  					fontWeight: '500'
  				}
  			],
  			display: [
  				'3.5rem',
  				{
  					lineHeight: '1.08',
  					letterSpacing: '-0.025em',
  					fontWeight: '500'
  				}
  			],
  			'display-sm': [
  				'2.75rem',
  				{
  					lineHeight: '1.1',
  					letterSpacing: '-0.02em',
  					fontWeight: '500'
  				}
  			]
  		}
  	}
  },
  plugins: [tailwindcssAnimate]
};

export default config;
