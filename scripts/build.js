import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create dist directory
mkdirSync(join(__dirname, '../dist'), { recursive: true });

// Read the data
const data = JSON.parse(readFileSync(join(__dirname, '../data/updates.json'), 'utf-8'));

// Read the HTML template
const htmlTemplate = readFileSync(join(__dirname, '../public/index.html'), 'utf-8');

// Embed data into HTML
const htmlWithData = htmlTemplate.replace(
  '</head>',
  `<script>window.__DATA__ = ${JSON.stringify(data)};</script>\n</head>`
);

// Write to dist
writeFileSync(join(__dirname, '../dist/index.html'), htmlWithData);

// Copy other assets
const logo = readFileSync(join(__dirname, '../public/logo.png'));
writeFileSync(join(__dirname, '../dist/logo.png'), logo);

console.log('Build completed - dist/index.html ready for GitHub Pages');
