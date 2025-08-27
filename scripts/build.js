
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUILD_PROFILES = {
  'apk': 'production',
  'aab': 'production-aab',
  'preview': 'preview',
  'play-console': 'play-console'
};

function showUsage() {
  console.log(`
Usage: node scripts/build.js [build-type] [platform]

Build Types:
  apk          - Build APK for production (default)
  aab          - Build AAB for Play Store
  preview      - Build preview APK
  play-console - Build AAB for Play Console upload

Platform:
  android      - Build for Android (default)
  ios          - Build for iOS
  all          - Build for both platforms

Examples:
  node scripts/build.js apk android
  node scripts/build.js aab android
  node scripts/build.js preview android
  node scripts/build.js play-console android
`);
}

function validateEasInstallation() {
  try {
    execSync('eas --version', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ EAS CLI not found. Please install it first:');
    console.error('npm install -g eas-cli');
    process.exit(1);
  }
}

function validateEasLogin() {
  try {
    execSync('eas whoami', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Not logged in to EAS. Please login first:');
    console.error('eas login');
    process.exit(1);
  }
}

function cleanBuildCache() {
  console.log('🧹 Cleaning build cache...');
  try {
    execSync('expo prebuild --clean', { stdio: 'inherit' });
  } catch (error) {
    console.warn('⚠️  Warning: Could not clean prebuild cache');
  }
}

function buildApp(buildType, platform) {
  const profile = BUILD_PROFILES[buildType];
  if (!profile) {
    console.error(`❌ Invalid build type: ${buildType}`);
    showUsage();
    process.exit(1);
  }

  console.log(`🚀 Building ${buildType.toUpperCase()} for ${platform}...`);
  console.log(`📋 Using profile: ${profile}`);

  const platformFlag = platform === 'all' ? '--platform all' : `--platform ${platform}`;
  const command = `eas build --profile ${profile} ${platformFlag} --non-interactive`;

  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ Build completed successfully!`);
    
    if (buildType === 'apk') {
      console.log(`📱 APK will be available at: android/app/build/outputs/apk/release/app-release.apk`);
    } else if (buildType === 'aab' || buildType === 'play-console') {
      console.log(`📦 AAB will be available at: android/app/build/outputs/bundle/release/app-release.aab`);
    }
  } catch (error) {
    console.error(`❌ Build failed with exit code: ${error.status}`);
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  const buildType = args[0] || 'apk';
  const platform = args[1] || 'android';

  console.log('🔍 Validating environment...');
  validateEasInstallation();
  validateEasLogin();

  if (args.includes('--clean')) {
    cleanBuildCache();
  }

  buildApp(buildType, platform);
}

if (require.main === module) {
  main();
}

module.exports = { buildApp, BUILD_PROFILES };
