
# Android Gradle Java 17 Configuration Fix

This document outlines the changes made to fix the Android build error related to the `--release` option in JavaCompile.

## Problem
The build was failing with:
```
A problem occurred configuring project ':react-native-reanimated'.
Using '--release' option for JavaCompile is not supported … Please use Java toolchain or set 'sourceCompatibility' and 'targetCompatibility' instead.
```

## Solution Applied

### 1. android/build.gradle (Top-Level)
- **REMOVED** any `allprojects` block containing `options.release = 17`
- **REMOVED** all references to `options.release` or `--release`
- Clean configuration without deprecated release flags

### 2. android/app/build.gradle (App Module)
Inside the `android { }` block, ensured EXACTLY:
```gradle
compileOptions {
    sourceCompatibility JavaVersion.VERSION_17
    targetCompatibility JavaVersion.VERSION_17
}

kotlinOptions {
    jvmTarget = '17'
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}
```

### 3. gradle.properties
- **REMOVED** any `--release` from `org.gradle.jvmargs`
- Set proper JVM arguments:
```properties
org.gradle.jvmargs=-Xmx4g -Dfile.encoding=UTF-8 -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError
```

### 4. Additional Configuration
- Set `org.gradle.daemon=true` for faster builds
- Set `org.gradle.parallel=true` for parallel execution
- Ensured `android.useAndroidX=true`
- Configured proper Gradle wrapper version (8.0.2)

## Build Commands
After making these changes, clean and rebuild:
```bash
./gradlew --stop
./gradlew clean
./gradlew :app:assembleRelease
```

## Key Points
- The `--release`/`options.release` flag blocks AGP from wiring the Android bootclasspath, which breaks libraries like react-native-reanimated
- Using `sourceCompatibility`/`targetCompatibility` + optional `java.toolchain` is the supported way on AGP 8+
- This configuration ensures compatibility with Java 17 while maintaining proper Android build toolchain integration

## Files Modified
- `android/build.gradle` - Top-level build configuration
- `android/app/build.gradle` - App module build configuration  
- `android/gradle.properties` - Gradle properties and JVM settings
- `android/gradle/wrapper/gradle-wrapper.properties` - Gradle wrapper version
