
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
    success(`Node.js version: ${version}`);
    
    // Check if Node version is compatible (should be >= 18)
    const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
    if (majorVersion < 18) {
      warning(`Node.js version ${version} might be too old. Consider upgrading to Node 18+`);
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

function runDiagnostics() {
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
