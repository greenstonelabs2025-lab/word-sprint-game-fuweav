
const { withGradleProperties, withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

const withPlayStoreConfig = (config) => {
  // Configure the top-level build.gradle - removed problematic options.release configuration
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let buildGradleContent = config.modResults.contents;
      
      // Remove any existing options.release configuration that causes Metro internal import errors
      buildGradleContent = buildGradleContent.replace(
        /tasks\.withType\(JavaCompile\)\.configureEach\s*{\s*options\.release\s*=\s*17\s*}/g,
        ''
      );
      
      // Remove empty allprojects blocks
      buildGradleContent = buildGradleContent.replace(
        /allprojects\s*{\s*}/g,
        ''
      );
      
      config.modResults.contents = buildGradleContent;
    }
    return config;
  });

  // Configure the app-level build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let buildGradleContent = config.modResults.contents;
      
      // Ensure we have the correct Android configuration
      if (!buildGradleContent.includes('compileSdkVersion 34')) {
        buildGradleContent = buildGradleContent.replace(
          /compileSdkVersion\s+\d+/,
          'compileSdkVersion 34'
        );
      }
      
      // Add Java 17 compile options using supported configuration
      if (!buildGradleContent.includes('sourceCompatibility JavaVersion.VERSION_17')) {
        // Find android block and add compileOptions
        buildGradleContent = buildGradleContent.replace(
          /android\s*{/,
          `android {
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
    }`
        );
      }
      
      // Check if defaultConfig already exists and add missingDimensionStrategy
      if (buildGradleContent.includes('defaultConfig {')) {
        // Add missingDimensionStrategy inside defaultConfig if not already present
        if (!buildGradleContent.includes("missingDimensionStrategy 'store', 'play'")) {
          buildGradleContent = buildGradleContent.replace(
            /defaultConfig\s*{([^}]*?)}/s,
            (match, content) => {
              return `defaultConfig {${content}
        missingDimensionStrategy 'store', 'play'
    }`;
            }
          );
        }
      }
      
      // Add flavorDimensions and productFlavors if not already present
      if (!buildGradleContent.includes('flavorDimensions')) {
        // Find the android block and add flavorDimensions and productFlavors
        buildGradleContent = buildGradleContent.replace(
          /android\s*{/,
          `android {
    flavorDimensions += ["store"]
    productFlavors {
        play {
            dimension "store"
            matchingFallbacks = ["play"]
        }
    }`
        );
      }
      
      // Ensure proper build types configuration
      if (!buildGradleContent.includes('buildTypes {')) {
        buildGradleContent = buildGradleContent.replace(
          /android\s*{([^}]*?)}/s,
          (match, content) => {
            if (!content.includes('buildTypes {')) {
              return `android {${content}
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
        debug {
            debuggable true
        }
    }
}`;
            }
            return match;
          }
        );
      }
      
      config.modResults.contents = buildGradleContent;
    }
    return config;
  });
  
  // Add gradle properties with corrected JVM arguments
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults || [];
    
    const properties = [
      // Clean JVM arguments without --release flag to prevent Metro internal import errors
      { key: 'org.gradle.jvmargs', value: '-Xmx4g -Dfile.encoding=UTF-8 -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError' },
      { key: 'org.gradle.parallel', value: 'true' },
      { key: 'org.gradle.configureondemand', value: 'true' },
      { key: 'org.gradle.daemon', value: 'true' },
      { key: 'android.useAndroidX', value: 'true' },
      { key: 'android.enableJetifier', value: 'true' }
    ];
    
    properties.forEach(prop => {
      const existingIndex = config.modResults.findIndex(item => 
        item.type === 'property' && item.key === prop.key
      );
      
      if (existingIndex >= 0) {
        config.modResults[existingIndex].value = prop.value;
      } else {
        config.modResults.push({
          type: 'property',
          key: prop.key,
          value: prop.value
        });
      }
    });
    
    return config;
  });
  
  return config;
};

module.exports = withPlayStoreConfig;
