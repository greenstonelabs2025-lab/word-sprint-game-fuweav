
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
  log('Clearing Expo cache...');
  try {
    execSync('npx expo start --clear', { stdio: 'pipe' });
    success('Expo cache cleared');
  } catch (err) {
    // This might fail if expo is not running, which is fine
    log('Expo cache clear attempted (may not have been running)');
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

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node scripts/fix-dependencies.js [options]

Options:
  --full       - Full clean (node_modules, cache, prebuild directories)
  --prebuild   - Only clean and run prebuild
  --cache      - Only clear caches
  --help, -h   - Show this help

Examples:
  node scripts/fix-dependencies.js --full
  node scripts/fix-dependencies.js --prebuild
  node scripts/fix-dependencies.js --cache
`);
    return;
  }

  console.log('🚀 Starting dependency fix process...');

  if (args.includes('--full')) {
    cleanNodeModules();
    cleanPrebuildDirectories();
    clearExpoCache();
    installDependencies();
    runExpoPrebuild();
  } else if (args.includes('--prebuild')) {
    cleanPrebuildDirectories();
    runExpoPrebuild();
  } else if (args.includes('--cache')) {
    clearExpoCache();
  } else {
    // Default: clean and reinstall
    cleanNodeModules();
    installDependencies();
    clearExpoCache();
  }

  success('Dependency fix process completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Try running: npm run android');
  console.log('2. If prebuild still fails, run: node scripts/fix-dependencies.js --full');
  console.log('3. For build issues, run: npm run build:android');
}

if (require.main === module) {
  main();
}

module.exports = { cleanNodeModules, installDependencies, clearExpoCache, cleanPrebuildDirectories, runExpoPrebuild };
