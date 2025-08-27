
const { withGradleProperties, withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

const withPlayStoreConfig = (config) => {
  // Configure the top-level build.gradle for Java 17
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let buildGradleContent = config.modResults.contents;
      
      // Add Java 17 configuration to allprojects block
      if (!buildGradleContent.includes('tasks.withType(JavaCompile)')) {
        // Find allprojects block or add it
        if (buildGradleContent.includes('allprojects {')) {
          buildGradleContent = buildGradleContent.replace(
            /allprojects\s*{([^}]*?)}/s,
            (match, content) => {
              return `allprojects {${content}
    tasks.withType(JavaCompile).configureEach {
        options.release = 17
    }
}`;
            }
          );
        } else {
          // Add allprojects block after buildscript
          buildGradleContent = buildGradleContent.replace(
            /buildscript\s*{[^}]*?}\s*/s,
            (match) => {
              return `${match}

allprojects {
    tasks.withType(JavaCompile).configureEach {
        options.release = 17
    }
}
`;
            }
          );
        }
      }
      
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
      
      // Add Java 17 compile options
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
      // Corrected JVM arguments - this is the key fix
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
