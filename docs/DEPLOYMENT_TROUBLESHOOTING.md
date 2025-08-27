
# Deployment Troubleshooting Guide

## Common APK/AAB Build Issues

### Issue: APK file not found at expected path
**Error:** `Failed to upload APK to S3: [Errno 2] No such file or directory: '/expo-project/android/app/build/outputs/apk/release/app-release.apk'`

**Solution:**
1. Check your `eas.json` build configuration
2. Ensure you're using the correct build profile for APK generation
3. Use `buildType: "apk"` and `gradleCommand: ":app:assembleRelease"` for APK builds

### Build Commands

#### For APK (recommended for testing/distribution):
```bash
npm run build:apk
# or
eas build --profile production --platform android
```

#### For AAB (Google Play Store):
```bash
npm run build:aab
# or
eas build --profile production-aab --platform android
```

#### For Preview/Testing:
```bash
npm run build:preview
# or
eas build --profile preview --platform android
```

### Build Profiles Explained

- **production**: Builds APK for general distribution
- **production-aab**: Builds AAB for Play Store submission
- **preview**: Builds APK for internal testing
- **play-console**: Builds AAB specifically for Play Console upload

### Troubleshooting Steps

1. **Clean build cache:**
   ```bash
   npm run build:clean
   ```

2. **Check EAS CLI version:**
   ```bash
   eas --version
   ```

3. **Verify login status:**
   ```bash
   eas whoami
   ```

4. **Check build logs:**
   ```bash
   eas build:list
   eas build:view [BUILD_ID]
   ```

5. **Prebuild locally to check for issues:**
   ```bash
   expo prebuild --platform android --clean
   ```

### Common Gradle Issues

#### Missing dimension strategy:
Add to your `android/app/build.gradle`:
```gradle
defaultConfig {
    missingDimensionStrategy 'store', 'play'
}
```

#### Build tools version mismatch:
Ensure your `app.json` has:
```json
{
  "android": {
    "compileSdkVersion": 34,
    "targetSdkVersion": 34,
    "buildToolsVersion": "34.0.0"
  }
}
```

### File Paths

- **APK Output:** `android/app/build/outputs/apk/release/app-release.apk`
- **AAB Output:** `android/app/build/outputs/bundle/release/app-release.aab`

### Environment Variables

Make sure these are set in your build environment:
- `EXPO_NO_CACHE=1` (for clean builds)
- Proper Android SDK paths
- Java 17+ for Expo SDK 53

### Build Performance Tips

1. Use `--local` flag for local builds when debugging
2. Enable Gradle daemon and parallel builds
3. Increase JVM heap size in gradle.properties
4. Use `--clear-cache` when builds fail unexpectedly

### Getting Help

If issues persist:
1. Check EAS Build logs in Expo dashboard
2. Run `expo doctor` to check for configuration issues
3. Verify all dependencies are compatible with Expo SDK 53
4. Check React Native 0.79.2 compatibility
