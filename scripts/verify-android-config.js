
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Android configuration...\n');

const checks = [
    {
        name: 'Top-level build.gradle exists',
        path: 'android/build.gradle',
        test: (content) => !content.includes('options.release')
    },
    {
        name: 'App build.gradle has Java 17 config',
        path: 'android/app/build.gradle',
        test: (content) => 
            content.includes('JavaVersion.VERSION_17') &&
            content.includes("jvmTarget = '17'") &&
            content.includes('JavaLanguageVersion.of(17)')
    },
    {
        name: 'gradle.properties has correct JVM args',
        path: 'android/gradle.properties',
        test: (content) => 
            content.includes('-XX:MaxMetaspaceSize=512m') &&
            !content.includes('--release')
    },
    {
        name: 'Gradle wrapper properties exists',
        path: 'android/gradle/wrapper/gradle-wrapper.properties',
        test: (content) => content.includes('gradle-8.0.2')
    }
];

let allPassed = true;

checks.forEach(check => {
    try {
        const content = fs.readFileSync(check.path, 'utf8');
        const passed = check.test(content);
        
        console.log(`${passed ? '✅' : '❌'} ${check.name}`);
        
        if (!passed) {
            allPassed = false;
        }
    } catch (error) {
        console.log(`❌ ${check.name} - File not found`);
        allPassed = false;
    }
});

console.log(`\n${allPassed ? '🎉 All checks passed!' : '⚠️  Some checks failed'}`);

if (allPassed) {
    console.log('\nYou can now build the Android app:');
    console.log('  npm run android:clean-build');
} else {
    console.log('\nPlease fix the issues above before building.');
}
