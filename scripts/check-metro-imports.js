
const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERNS = [
  'metro-cache/src/',
  'metro-config/src/',
  'metro-core/src/',
  'FileStore',
  'AssetStore'
];

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'android',
  'ios',
  '.expo',
  'dist',
  'build'
];

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = [];
    
    FORBIDDEN_PATTERNS.forEach(pattern => {
      if (content.includes(pattern)) {
        violations.push(pattern);
      }
    });
    
    return violations;
  } catch (error) {
    // Skip files that can't be read
    return [];
  }
}

function scanDirectory(dir) {
  const violations = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!EXCLUDED_DIRS.includes(item)) {
          violations.push(...scanDirectory(fullPath));
        }
      } else if (stat.isFile()) {
        // Only check text files
        const ext = path.extname(item).toLowerCase();
        if (['.js', '.ts', '.tsx', '.jsx', '.json', '.md'].includes(ext)) {
          const fileViolations = checkFile(fullPath);
          if (fileViolations.length > 0) {
            violations.push({
              file: fullPath,
              patterns: fileViolations
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${dir}: ${error.message}`);
  }
  
  return violations;
}

function main() {
  console.log('🔍 Checking for Metro internal imports...');
  
  const violations = scanDirectory('.');
  
  if (violations.length === 0) {
    console.log('✅ No Metro internal imports found!');
    process.exit(0);
  } else {
    console.error('❌ Found Metro internal imports:');
    violations.forEach(violation => {
      console.error(`  ${violation.file}: ${violation.patterns.join(', ')}`);
    });
    console.error('\nPlease remove these imports and use only @expo/metro-config public API.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, scanDirectory, FORBIDDEN_PATTERNS };
