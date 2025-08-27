
const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

const withPlayStoreConfig = (config) => {
  // Add the missingDimensionStrategy and productFlavors to build.gradle
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
  
  // Add gradle properties for better build performance
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults || [];
    
    const properties = [
      'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m',
      'org.gradle.parallel=true',
      'org.gradle.configureondemand=true',
      'org.gradle.daemon=true',
      'android.useAndroidX=true',
      'android.enableJetifier=true'
    ];
    
    properties.forEach(prop => {
      const [key] = prop.split('=');
      const existingIndex = config.modResults.findIndex(item => 
        item.type === 'property' && item.key === key
      );
      
      if (existingIndex >= 0) {
        config.modResults[existingIndex].value = prop.split('=')[1];
      } else {
        config.modResults.push({
          type: 'property',
          key: key,
          value: prop.split('=')[1]
        });
      }
    });
    
    return config;
  });
  
  return config;
};

module.exports = withPlayStoreConfig;
