#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building browser extension...');

const rootDir = path.join(__dirname, '..');
const extensionDir = path.join(rootDir, 'extension');
const publicDir = path.join(rootDir, 'public');
const zipPath = path.join(publicDir, 'stackapply-extension.zip');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Remove old zip if it exists
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
  console.log('🗑️  Removed old extension zip');
}

try {
  // Create new zip (excluding .DS_Store and node_modules)
  execSync(
    `cd "${rootDir}" && zip -r "${zipPath}" extension/ -x "*.DS_Store" "*/node_modules/*"`,
    { stdio: 'inherit' }
  );
  
  // Get file size for confirmation
  const stats = fs.statSync(zipPath);
  const sizeInKB = (stats.size / 1024).toFixed(2);
  
  console.log('✅ Extension built successfully!');
  console.log(`📦 Size: ${sizeInKB} KB`);
  console.log(`📍 Location: ${zipPath}`);
} catch (error) {
  console.error('❌ Error building extension:', error.message);
  process.exit(1);
}
