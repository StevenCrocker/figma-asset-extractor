#!/usr/bin/env node

import AdmZip from 'adm-zip';
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- simple arg parsing ----
const args = process.argv.slice(2);
if (args.length < 1 || args.includes('-h') || args.includes('--help')) {
	console.log(`
Usage:
  figma-asset-extractor <path/to/file.fig> [options]

Arguments:
  <path/to/file.fig>    Path to the .fig file to extract assets from (required)

Options:
  --out <outputDir>     Specify custom output directory (optional)
						Default: creates folder named after .fig file
  --webp                Convert all non-vector assets to WebP format (optional)
  --avif                Convert all non-vector assets to AVIF format (optional)
  --quality <1-100>     Quality for WebP/AVIF conversion (optional, default: 80)
  --max-width <pixels>  Resize images larger than max-width while maintaining aspect ratio (optional)
  --max-height <pixels> Resize images larger than max-height while maintaining aspect ratio (optional)
  --quiet               Suppress console output (optional)
  -h, --help            Show this help message

Examples:
  figma-asset-extractor design.fig
  figma-asset-extractor design.fig --out ./assets --webp
  figma-asset-extractor design.fig --avif --quality 90 --max-width 1920 --max-height 1080
  figma-asset-extractor design.fig --webp --quality 60 --max-width 800 --quiet

What it does:
  • Extracts assets from the .fig file
  • Creates an output folder named after the .fig file (minus extension) or folder specified with --out
  • Adds correct file extensions by inspecting MIME magic bytes
  • Optionally converts raster images to WebP or AVIF for better compression
  • Optionally resizes images to fit within specified dimensions
`);
	process.exit(0);
}

let figPath = null;
let outDir = null;
let quiet = false;
let debug = false;
let convertToWebp = false;
let convertToAvif = false;
let quality = 80;
let maxWidth = null;
let maxHeight = null;

for (let i = 0; i < args.length; i++) {
	const a = args[i];
	if (!figPath && !a.startsWith('-')) {
		figPath = a;
	} else if (a === '--out') {
		outDir = args[i + 1];
		i++;
	} else if (a === '--webp') {
		convertToWebp = true;
	} else if (a === '--avif') {
		convertToAvif = true;
	} else if (a === '--quality') {
		quality = parseInt(args[i + 1], 10);
		if (isNaN(quality) || quality < 1 || quality > 100) {
			console.error('Error: --quality must be a number between 1 and 100');
			process.exit(1);
		}
		i++;
	} else if (a === '--max-width') {
		maxWidth = parseInt(args[i + 1], 10);
		if (isNaN(maxWidth) || maxWidth <= 0) {
			console.error('Error: --max-width must be a positive number');
			process.exit(1);
		}
		i++;
	} else if (a === '--max-height') {
		maxHeight = parseInt(args[i + 1], 10);
		if (isNaN(maxHeight) || maxHeight <= 0) {
			console.error('Error: --max-height must be a positive number');
			process.exit(1);
		}
		i++;
	} else if (a === '--quiet') {
		quiet = true;
	} else if (a === '--debug') {
		debug = true;
	}
}

if (!figPath) {
	console.error('Error: Missing .fig path.');
	process.exit(1);
}

if (!fs.existsSync(figPath)) {
	console.error(`Error: File not found: ${figPath}`);
	process.exit(1);
}

const figExt = path.extname(figPath).toLowerCase();
if (figExt !== '.fig' && figExt !== '.zip') {
	// Allow .zip just in case someone already renamed it
	if (!quiet) console.warn('Warning: File does not have .fig extension. Proceeding anyway.');
}

// default output directory is <basename-without-ext>
const defaultOut = path.resolve(process.cwd(), path.basename(figPath, path.extname(figPath)));
const outputDir = outDir ? path.resolve(process.cwd(), outDir) : defaultOut;

// ensure output dir exists
fs.mkdirSync(outputDir, { recursive: true });

function log(...m) {
	if (!quiet) console.log(...m);
}

function debugLog(...m) {
	if (debug && !quiet) console.log(...m);
}

// Check if file is readable and get basic info (moved after log function definition)
try {
	const stats = fs.statSync(figPath);
	log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
	if (stats.size === 0) {
		console.error('Error: File is empty');
		process.exit(1);
	}
} catch (e) {
	console.error(`Error reading file stats: ${e.message}`);
	process.exit(1);
}

// Utility: ensure unique file path if a name collision occurs
// Overwrite files if they exist (no uniquePath logic)
function uniquePath(p) {
	return p;
}

async function extractImagesOnly(figFile, destDir) {
	log(`Extracting images from: ${figFile}`);

	// First, let's try to validate the file is actually a ZIP archive
	try {
		const fileBuffer = fs.readFileSync(figFile, { start: 0, end: 4 });
		// Only check the first 4 bytes for ZIP signature
		const zipSignature = fileBuffer.toString('hex');
		if (!zipSignature.startsWith('504b')) {
			debugLog('⚠️  File does not appear to be a ZIP archive. Extraction may fail.');
		}
	} catch (e) {
		debugLog('Could not read file signature:', e.message);
	}

	// Method 1: Try ADM-ZIP (synchronous, more reliable)
	try {
		debugLog('🔧 Trying ADM-ZIP extraction method...');
		const zip = new AdmZip(figFile);
		const entries = zip.getEntries();

		debugLog(`Found ${entries.length} entries in archive`);

		let imageCount = 0;
		let allEntries = [];

		entries.forEach((entry, index) => {
			const entryPath = entry.entryName.replace(/\\/g, '/');
			allEntries.push(entryPath);
			debugLog(`  Entry ${index + 1}: ${entryPath} (${entry.header.method === 0 ? 'stored' : 'compressed'}, ${entry.header.size} bytes)`);

			// Check if this is an image file in the images directory
			if (!entry.isDirectory && entryPath.startsWith('images/')) {
				imageCount++;
				const filename = entryPath.substring('images/'.length);
				const outPath = path.join(destDir, filename);

				// Create directory if needed
				fs.mkdirSync(path.dirname(outPath), { recursive: true });

				debugLog(`  📷 Extracting image: ${filename}`);

				// Extract the file
				const data = entry.getData();
				fs.writeFileSync(outPath, data);
			}
		});

		if (debug) {
			log('\n🔍 Debug: Contents of .fig file:');
			if (allEntries.length === 0) {
				log('   No entries found in archive');
			} else {
				log(`   Total entries: ${allEntries.length}`);
				allEntries.forEach((entry) => {
					const isImage = entry.startsWith('images/');
					log(`   ${isImage ? '📷' : '📄'} ${entry}`);
				});
			}
			log('');
		}

		if (imageCount === 0) {
			log('⚠️  No images found in the .fig file');
			if (debug) {
				log('   This could mean:');
				log('   • The .fig file has no embedded images');
				log('   • Images are stored in a different directory structure');
				log('   • The .fig file is corrupted or not a standard Figma file');
			}
		} else {
			log(`✅ Successfully extracted ${imageCount} images`);
		}

		return; // Success, no need to try other methods
	} catch (e) {
		debugLog(`❌ ADM-ZIP extraction failed: ${e.message}`);
		log('❌ Extraction failed. The .fig file may be corrupted or use an unsupported format.');
		throw e;
	}
}

async function addExtensionsInFolder(destDir) {
	const files = fs.readdirSync(destDir, { withFileTypes: true });
	const allFiles = files.filter((f) => f.isFile());
	const targets = files.filter((f) => f.isFile() && path.extname(f.name) === '');

	debugLog(`Found ${allFiles.length} total files in output directory`);
	if (debug && allFiles.length > 0) {
		log('Files found:');
		allFiles.forEach((f) => {
			const hasExt = path.extname(f.name) !== '';
			log(`  • ${f.name}${hasExt ? ' (already has extension)' : ' (needs extension)'}`);
		});
	}

	if (targets.length === 0) {
		debugLog('No extensionless files found to rename.');
		if (allFiles.length === 0) {
			log('⚠️  Output directory is empty - no images were extracted');
		}
		return;
	}

	log(`Adding file extensions to ${targets.length} files...`);
	for (const f of targets) {
		const full = path.join(destDir, f.name);
		try {
			// Read enough bytes for detection
			const buf = fs.readFileSync(full);
			const ft = await fileTypeFromBuffer(buf);

			let ext = null;
			let isVector = false;
			let needsProcessing = false;

			if (!ft) {
				// Try to detect SVG by checking for XML content
				const text = buf.toString('utf8', 0, Math.min(1024, buf.length));
				if (text.includes('<svg') || (text.includes('<?xml') && text.includes('svg'))) {
					ext = 'svg';
					isVector = true;
				} else {
					debugLog(`  • Unknown type (leaving as-is): ${f.name}`);
					continue;
				}
			} else {
				// Normalize common extensions
				ext = ft.ext === 'jpeg' ? 'jpg' : ft.ext;
				// Check if it's a raster image that can be processed
				isVector = ext === 'svg' || ext === 'eps';
				needsProcessing = !isVector && (convertToWebp || convertToAvif || maxWidth || maxHeight);
			}

			if (needsProcessing) {
				// Process raster images with Sharp
				await processRasterImage(full, f.name, destDir, ext);
			} else {
				// Just rename the file with proper extension
				const renamed = path.join(destDir, `${f.name}.${ext}`);
				fs.renameSync(full, renamed);
				const detection = ft ? '' : ' (detected as SVG)';
				debugLog(`  • ${f.name} → ${path.basename(renamed)}${detection}`);
			}
		} catch (e) {
			console.error(`  ! Failed to process ${f.name}:`, e.message);
		}
	}
	log('✓ Done adding extensions.');
}

async function processRasterImage(inputPath, originalName, destDir, originalExt) {
	try {
		let pipeline = sharp(inputPath);

		// Get image metadata to check if resizing is needed
		const metadata = await pipeline.metadata();
		let needsResize = false;
		let newWidth = metadata.width;
		let newHeight = metadata.height;

		// Calculate new dimensions if max constraints are specified
		if (maxWidth || maxHeight) {
			const widthRatio = maxWidth ? maxWidth / metadata.width : 1;
			const heightRatio = maxHeight ? maxHeight / metadata.height : 1;
			const scale = Math.min(widthRatio, heightRatio, 1); // Don't upscale

			if (scale < 1) {
				needsResize = true;
				newWidth = Math.round(metadata.width * scale);
				newHeight = Math.round(metadata.height * scale);
				pipeline = pipeline.resize(newWidth, newHeight);
			}
		}

		// Determine output format and extension
		let outputExt = originalExt;
		if (convertToAvif) {
			pipeline = pipeline.avif({ quality: quality });
			outputExt = 'avif';
		} else if (convertToWebp) {
			pipeline = pipeline.webp({ quality: quality });
			outputExt = 'webp';
		}

		// Generate output filename
		const outputName = `${originalName}.${outputExt}`;
		const outputPath = path.join(destDir, outputName);

		// Process and save the image (overwrite if exists)
		await pipeline.toFile(outputPath);

		// Remove the original file
		fs.unlinkSync(inputPath);

		// Log the transformation
		let transformations = [];
		if (needsResize) {
			transformations.push(`${metadata.width}x${metadata.height} → ${newWidth}x${newHeight}`);
		}
		if (convertToAvif || convertToWebp) {
			transformations.push(`${originalExt} → ${outputExt}`);
		}
		const transformText = transformations.length > 0 ? ` (${transformations.join(', ')})` : '';

		log(`  • ${originalName} → ${path.basename(outputPath)}${transformText}`);
	} catch (e) {
		console.error(`  ! Failed to process raster image ${originalName}:`, e.message);
		// If processing fails, fall back to just renaming (overwrite)
		const fallbackPath = path.join(destDir, `${originalName}.${originalExt}`);
		fs.renameSync(inputPath, fallbackPath);
		log(`  • ${originalName} → ${path.basename(fallbackPath)} (processing failed, kept original)`);
	}
}

(async () => {
	try {
		await extractImagesOnly(figPath, outputDir);
		await addExtensionsInFolder(outputDir);
		log(`\nAll set! Images are in: ${outputDir}`);
	} catch (e) {
		console.error('Unexpected error:', e);
		process.exit(1);
	}
})();
