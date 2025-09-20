
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(message) {
  console.log(`🔧 ${message}`);
}

function error(message) {
  console.error(`❌ ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
}

function cleanNodeModules() {
  log('Cleaning node_modules and lock files...');
  try {
    // Remove node_modules
    if (fs.existsSync('node_modules')) {
      execSync('rm -rf node_modules', { stdio: 'inherit' });
    }
    
    // Remove lock files
    if (fs.existsSync('package-lock.json')) {
      fs.unlinkSync('package-lock.json');
    }
    if (fs.existsSync('yarn.lock')) {
      fs.unlinkSync('yarn.lock');
    }
    
    success('Cleaned node_modules and lock files');
  } catch (err) {
    error(`Failed to clean: ${err.message}`);
    process.exit(1);
  }
}

function installDependencies() {
  log('Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    success('Dependencies installed successfully');
  } catch (err) {
    error(`Failed to install dependencies: ${err.message}`);
    process.exit(1);
  }
}

function clearExpoCache() {
  log('Clearing Expo and Metro caches...');
  try {
    // Clear .expo directory
    if (fs.existsSync('.expo')) {
      execSync('rm -rf .expo', { stdio: 'inherit' });
      log('Cleared .expo directory');
    }
    
    // Clear node_modules cache
    if (fs.existsSync('node_modules/.cache')) {
      execSync('rm -rf node_modules/.cache', { stdio: 'inherit' });
      log('Cleared node_modules/.cache');
    }
    
    // Clear Metro temp files
    try {
      execSync('rm -rf /tmp/metro-*', { stdio: 'inherit' });
      log('Cleared Metro temp files');
    } catch (err) {
      // This might fail on different systems, which is fine
      log('Metro temp files clear attempted');
    }
    
    // Clear watchman cache if available
    try {
      execSync('watchman watch-del-all', { stdio: 'pipe' });
      log('Cleared watchman cache');
    } catch (err) {
      // Watchman might not be installed, which is fine
      log('Watchman not available (optional)');
    }
    
    success('Expo and Metro caches cleared');
  } catch (err) {
    error(`Failed to clear caches: ${err.message}`);
  }
}

function cleanPrebuildDirectories() {
  log('Cleaning prebuild directories...');
  try {
    if (fs.existsSync('android')) {
      execSync('rm -rf android', { stdio: 'inherit' });
    }
    if (fs.existsSync('ios')) {
      execSync('rm -rf ios', { stdio: 'inherit' });
    }
    success('Prebuild directories cleaned');
  } catch (err) {
    error(`Failed to clean prebuild directories: ${err.message}`);
  }
}

function runExpoPrebuild() {
  log('Running expo prebuild...');
  try {
    execSync('npx expo prebuild --clean', { stdio: 'inherit' });
    success('Expo prebuild completed successfully');
  } catch (err) {
    error(`Expo prebuild failed: ${err.message}`);
    process.exit(1);
  }
}

function checkMetroImports() {
  log('Checking for Metro internal imports...');
  try {
    execSync('node scripts/check-metro-imports.js', { stdio: 'inherit' });
    success('Metro imports check passed');
  } catch (err) {
    error('Metro imports check failed - please fix Metro internal imports first');
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node scripts/fix-dependencies.js [options]

Options:
  --full       - Full clean (node_modules, cache, prebuild directories)
  --prebuild   - Only clean and run prebuild
  --cache      - Only clear caches
  --metro      - Fix Metro-related issues (clean caches and check imports)
  --help, -h   - Show this help

Examples:
  node scripts/fix-dependencies.js --full
  node scripts/fix-dependencies.js --prebuild
  node scripts/fix-dependencies.js --cache
  node scripts/fix-dependencies.js --metro
`);
    return;
  }

  console.log('🚀 Starting dependency fix process...');

  // Always check Metro imports first
  checkMetroImports();

  if (args.includes('--full')) {
    cleanNodeModules();
    cleanPrebuildDirectories();
    clearExpoCache();
    installDependencies();
    runExpoPrebuild();
  } else if (args.includes('--prebuild')) {
    cleanPrebuildDirectories();
    runExpoPrebuild();
  } else if (args.includes('--cache') || args.includes('--metro')) {
    clearExpoCache();
  } else {
    // Default: clean and reinstall
    cleanNodeModules();
    installDependencies();
    clearExpoCache();
  }

  success('Dependency fix process completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Try running: npm run start');
  console.log('2. If Metro errors persist, run: node scripts/fix-dependencies.js --full');
  console.log('3. For Android builds, run: npm run android');
}

if (require.main === module) {
  main();
}

module.exports = { cleanNodeModules, installDependencies, clearExpoCache, cleanPrebuildDirectories, runExpoPrebuild };
