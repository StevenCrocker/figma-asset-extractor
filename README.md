# Figma Asset Extractor

[![npm version](https://img.shields.io/npm/v/figma-asset-extractor.svg)](https://www.npmjs.com/package/figma-asset-extractor)

This is a command line tool (not a figma plugin) that is perfect for developers to easily extract all image assets from a .fig file locally. This outputs all assets individually in their original form, not as combined layers or groups.

## Features

- Extracts all image assets from your Figma file in one step
- Lets you optionally choose your output folder (default: filename without .fig extension)
- Can optionally convert images to WebP or AVIF for smaller file sizes
- Optionally set max dimensions of images as you extract them
- Simple, fast, and works with a single command

## Install

```bash
npm install -g figma-asset-extractor
```

## Usage

```bash
figma-asset-extractor my-design.fig
```

## Options

- `--out <directory>`: Choose a different output folder
- `--webp` or `--avif`: Convert images to WebP or AVIF
- `--quality <1-100>`: Set quality for WebP/AVIF (default: 80)
- `--max-width <px>` / `--max-height <px>`: Resize images
- `--quiet`: Suppress output

## Advanced Usage

### Choose a different output folder

```bash
figma-asset-extractor my-design.fig --out ./assets
```

### Extract images as WebP

```bash
figma-asset-extractor my-design.fig --webp
```

### Extract images as Avif

```bash
figma-asset-extractor my-design.fig --avif
```

### If using --webp or --avif, change quality (default: 80)

```bash
figma-asset-extractor my-design.fig --webp --quality 90
```

### Constrain image size as you extract

```bash
figma-asset-extractor my-design.fig --max-width 800 --max-height 600
```

### Everything example

```bash
figma-asset-extractor design.fig --out ./assets --webp --quality 90 --max-width 1200
```

## Requirements

- Node.js 14+
- A Figma `.fig` file

---

For issues or suggestions, visit the [GitHub repo](https://github.com/StevenCrocker/figma-asset-extractor).
