
const { execSync } = require('child_process');
const fs = require('fs');

function log(message) {
  console.log(`🔍 ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
}

function error(message) {
  console.error(`❌ ${message}`);
}

function warning(message) {
  console.warn(`⚠️  ${message}`);
}

function checkExpoVersion() {
  try {
    const output = execSync('npx expo --version', { encoding: 'utf8' });
    success(`Expo CLI version: ${output.trim()}`);
    return true;
  } catch (err) {
    error('Expo CLI not found or not working');
    return false;
  }
}

function checkNodeVersion() {
  try {
    const output = execSync('node --version', { encoding: 'utf8' });
    const version = output.trim();
    log(`Node.js version: ${version}`);
    
    // Check if Node version is compatible (should be >= 18 and < 21)
    const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
    if (majorVersion < 18) {
      error(`Node.js version ${version} is too old. Please upgrade to Node 18 or 20.`);
      return false;
    } else if (majorVersion >= 21) {
      error(`Node.js version ${version} is not supported. Expo tooling is not stable on Node 22+. Please use Node 18 or 20.`);
      return false;
    } else {
      success(`Node.js version ${version} is compatible`);
    }
    return true;
  } catch (err) {
    error('Node.js not found');
    return false;
  }
}

function checkPackageJson() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    success('package.json is valid');
    
    // Check Expo SDK version
    if (packageJson.dependencies.expo) {
      success(`Expo SDK version: ${packageJson.dependencies.expo}`);
    } else {
      error('Expo SDK not found in dependencies');
      return false;
    }
    
    // Check for prebuild config
    if (packageJson.dependencies['@expo/prebuild-config']) {
      success(`Prebuild config version: ${packageJson.dependencies['@expo/prebuild-config']}`);
    } else {
      error('@expo/prebuild-config not found in dependencies');
      return false;
    }
    
    return true;
  } catch (err) {
    error(`package.json error: ${err.message}`);
    return false;
  }
}

function checkAppJson() {
  try {
    const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
    success('app.json is valid');
    
    if (appJson.expo && appJson.expo.name) {
      success(`App name: ${appJson.expo.name}`);
    } else {
      error('Invalid app.json structure');
      return false;
    }
    
    return true;
  } catch (err) {
    error(`app.json error: ${err.message}`);
    return false;
  }
}

function checkNodeModules() {
  if (fs.existsSync('node_modules')) {
    success('node_modules directory exists');
    
    // Check if expo module exists
    if (fs.existsSync('node_modules/expo')) {
      success('Expo module installed');
    } else {
      error('Expo module not found in node_modules');
      return false;
    }
    
    // Check if prebuild config exists
    if (fs.existsSync('node_modules/@expo/prebuild-config')) {
      success('@expo/prebuild-config module installed');
    } else {
      error('@expo/prebuild-config module not found in node_modules');
      return false;
    }
    
    return true;
  } else {
    error('node_modules directory not found');
    return false;
  }
}

function checkMetroConfig() {
  try {
    if (fs.existsSync('metro.config.js')) {
      const metroConfig = fs.readFileSync('metro.config.js', 'utf8');
      
      // Check for forbidden Metro internal imports
      const forbiddenPatterns = ['TerminalReporter', 'metro/src/', 'metro-cache/src/', 'metro-core/src/', 'metro-config/src/'];
      const violations = forbiddenPatterns.filter(pattern => metroConfig.includes(pattern));
      
      if (violations.length > 0) {
        error(`Metro config contains forbidden internal imports: ${violations.join(', ')}`);
        return false;
      } else {
        success('Metro config is clean (no internal imports)');
      }
    } else {
      error('metro.config.js not found');
      return false;
    }
    return true;
  } catch (err) {
    error(`Metro config error: ${err.message}`);
    return false;
  }
}

function runDiagnostics() {
  try {
    log('Running Metro imports check...');
    execSync('node scripts/check-metro-imports.js', { stdio: 'inherit' });
    success('Metro imports check passed');
  } catch (err) {
    error('Metro imports check failed - please fix Metro internal imports');
  }
  
  try {
    log('Running Expo diagnostics...');
    execSync('npx expo doctor', { stdio: 'inherit' });
    success('Expo diagnostics completed');
  } catch (err) {
    warning('Expo diagnostics failed or found issues');
  }
}

function main() {
  console.log('🚀 Verifying Expo setup...\n');
  
  let allChecksPass = true;
  
  allChecksPass &= checkNodeVersion();
  allChecksPass &= checkExpoVersion();
  allChecksPass &= checkPackageJson();
  allChecksPass &= checkAppJson();
  allChecksPass &= checkNodeModules();
  allChecksPass &= checkMetroConfig();
  
  console.log('\n📋 Running additional diagnostics...');
  runDiagnostics();
  
  if (allChecksPass) {
    console.log('\n🎉 All checks passed! Your Expo setup looks good.');
    console.log('\n📋 Next steps:');
    console.log('1. Try running: npm run fix-deps');
    console.log('2. Then try: npm run prebuild:clean');
    console.log('3. Finally: npm run android');
  } else {
    console.log('\n❌ Some checks failed. Please fix the issues above.');
    console.log('\n🔧 Suggested fixes:');
    console.log('1. Run: npm run fix-deps:full');
    console.log('2. Check your Node.js version (should be 18+)');
    console.log('3. Ensure Expo CLI is properly installed');
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkExpoVersion, checkNodeVersion, checkPackageJson, checkAppJson, checkNodeModules };
