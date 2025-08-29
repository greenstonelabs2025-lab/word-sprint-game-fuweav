
#!/bin/bash

# Setup Android build environment
echo "Setting up Android build environment..."

# Make gradlew executable
chmod +x android/gradlew

# Download gradle wrapper jar if it doesn't exist
if [ ! -f "android/gradle/wrapper/gradle-wrapper.jar" ]; then
    echo "Downloading Gradle wrapper..."
    cd android
    ./gradlew wrapper --gradle-version 8.0.2
    cd ..
fi

echo "Android setup complete!"
echo ""
echo "To build the app, run:"
echo "  cd android"
echo "  ./gradlew --stop"
echo "  ./gradlew clean"
echo "  ./gradlew :app:assembleRelease"
