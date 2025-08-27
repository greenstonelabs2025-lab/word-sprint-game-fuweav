
# Gradle JVM Arguments & Java 17 Fix

This document explains the fixes applied to resolve the "Improperly specified VM option 'MaxMetaspaceSize'" error and ensure Java 17 compatibility.

## Problem

The build was failing with:
```
Improperly specified VM option 'MaxMetaspaceSize'
```

This was caused by incorrect JVM arguments in the Gradle configuration.

## Solution Applied

### 1. Fixed JVM Arguments in `plugins/withPlayStoreConfig.js`

**Before (incorrect):**
```
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
```

**After (corrected):**
```
org.gradle.jvmargs=-Xmx4g -Dfile.encoding=UTF-8 -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError
```

**Key changes:**
- Added `-Dfile.encoding=UTF-8` for proper encoding
- Added `-XX:+HeapDumpOnOutOfMemoryError` for debugging
- Changed `-Xmx4096m` to `-Xmx4g` (equivalent but cleaner)

### 2. Added Java 17 Configuration

**Top-level `android/build.gradle`:**
```gradle
allprojects {
    tasks.withType(JavaCompile).configureEach {
        options.release = 17
    }
}
```

**App-level `android/app/build.gradle`:**
```gradle
android {
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = '17'
    }
}
```

### 3. Enhanced Build Script

Added Gradle cleaning commands to `scripts/build.js`:
- `./gradlew --stop` - Stops Gradle daemon
- `./gradlew clean` - Cleans build artifacts

## Usage

### Clean Build (Recommended)
```bash
npm run build:clean
# or
node scripts/build.js apk android --clean
```

### Manual Gradle Clean
```bash
npm run gradle:clean
# or
cd android && ./gradlew --stop && ./gradlew clean
```

### Regular Build
```bash
npm run build:apk
# or
node scripts/build.js apk android
```

## Troubleshooting

### If build still fails:

1. **Check Java version:**
   ```bash
   java -version
   ```
   Should show Java 17.

2. **Clean everything:**
   ```bash
   npm run build:clean
   ```

3. **Manual clean and rebuild:**
   ```bash
   expo prebuild --clean
   cd android
   ./gradlew --stop
   ./gradlew clean
   cd ..
   npm run build:apk
   ```

4. **Check EAS build logs** for detailed error information.

### Environment Requirements

- **Java 17** (required for Android Gradle Plugin compatibility)
- **Android SDK 34** (configured in app.json)
- **EAS CLI** (for builds)

## Additional Gradle Properties

The following properties are also configured for optimal performance:

```properties
org.gradle.daemon=true
org.gradle.parallel=true
android.useAndroidX=true
android.enableJetifier=true
```

## Notes

- These changes are applied automatically through the Expo config plugin
- The configuration ensures compatibility with React Native and Android Gradle Plugin
- Java 17 is pinned to avoid issues with newer JDK versions (like JDK 23)
