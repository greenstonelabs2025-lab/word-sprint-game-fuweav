
const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

const withPlayStoreConfig = (config) => {
  // Add the missingDimensionStrategy and productFlavors to build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let buildGradleContent = config.modResults.contents;
      
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
      
      config.modResults.contents = buildGradleContent;
    }
    return config;
  });
  
  return config;
};

module.exports = withPlayStoreConfig;
