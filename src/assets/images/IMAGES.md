# Image Assets

Place local image files here. Astro will optimize them at build time via `astro:assets`.

## Required images (replace placeholders with real photos)

| Filename | Purpose | Recommended size |
|---|---|---|
| `hero.jpg` | Hero section background | 1920×1080 |
| `limon-1.jpg` | Limón portrait (main spotlight photo) | 800×800 |
| `limon-2.jpg` | Limón action shot (optional) | 800×600 |
| `neighborhood-1.jpg` | Meades Crossing / Taneytown scenic | 600×400 |
| `neighborhood-2.jpg` | Local landmark or trail photo | 600×400 |
| `family.jpg` | Family photo (optional) | 800×600 |

## Public assets (already in `/public/`)

| Filename | Purpose |
|---|---|
| `og-image.png` | Social sharing preview (1200×630) |
| `favicon.svg` | Scalable favicon |
| `favicon.ico` | Legacy favicon fallback |
| `apple-touch-icon.png` | iOS home screen icon (180×180) |
| `icon-192.png` | PWA icon (192×192) |
| `icon-512.png` | PWA icon (512×512) |

## How to use an image in a component

```astro
---
import { Image } from 'astro:assets';
import heroImage from '../assets/images/hero.jpg';
---
<Image src={heroImage} alt="Descriptive alt text" width={1200} />
```

Astro automatically generates optimized WebP/AVIF versions at build time.
All public images (og-image, favicons) go in `/public/` and are copied as-is.
