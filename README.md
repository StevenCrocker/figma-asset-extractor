# Figma Asset Extractor

Easily save all your images from a Figma `.fig` file. Perfect for developers, and anyone who needs to quickly grab assets from a Figma project. This is not a figma plugin, it is a simple command line tool.

## Features

- Extracts all image assets from your Figma file in one step
- Lets you optionally choose your output location or defaults to .fig filename (minus extension)
- Can optionally convert images to WebP or AVIF for smaller file sizes
- Optionally set max dimensions of images as you extract them
- Simple, fast, and works with a single command

## Install

```bash
npm install -g figma-asset-extractor
```

## Usage

### Basic example

Extract all images to a folder named after your file:

```bash
figma-asset-extractor my-design.fig
```

### Choose a different output folder

```bash
figma-asset-extractor my-design.fig --out ./assets
```

### Convert images to WebP

```bash
figma-asset-extractor my-design.fig --webp
```

### Resize images as you extract

```bash
figma-asset-extractor my-design.fig --max-width 800 --max-height 600
```

### Everything example

```bash
figma-asset-extractor design.fig --out ./assets --webp --quality 90 --max-width 1200
```

## Options

- `--out <directory>`: Choose a different output folder
- `--webp` or `--avif`: Convert images to WebP or AVIF
- `--quality <1-100>`: Set quality for WebP/AVIF (default: 80)
- `--max-width <px>` / `--max-height <px>`: Resize images
- `--quiet`: Suppress output

## Requirements

- Node.js 14+
- A Figma `.fig` file

---

For issues or suggestions, visit the [GitHub repo](https://github.com/StevenCrocker/figma-asset-extractor).
