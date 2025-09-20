
const fs = require('fs');
const path = require('path');

function log(message) {
  console.log(`[CLEANUP] ${message}`);
}

function error(message) {
  console.error(`[ERROR] ${message}`);
}

function success(message) {
  console.log(`[SUCCESS] ${message}`);
}

function removePnpmArtifacts() {
  const artifactsToRemove = [
    'pnpm-lock.yaml',
    'yarn.lock',
    '.yarnrc',
    '.yarnrc.yml',
    '.pnpmfile.cjs'
  ];

  artifactsToRemove.forEach(artifact => {
    const filePath = path.join(process.cwd(), artifact);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        success(`Removed ${artifact}`);
      } catch (err) {
        error(`Failed to remove ${artifact}: ${err.message}`);
      }
    } else {
      log(`${artifact} not found (already clean)`);
    }
  });
}

function updateGitignore() {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  
  if (!fs.existsSync(gitignorePath)) {
    error('.gitignore not found');
    return;
  }

  let content = fs.readFileSync(gitignorePath, 'utf8');
  
  // Add package manager exclusions if not already present
  const packageManagerSection = `
# Package managers - only allow npm
pnpm-lock.yaml
yarn.lock
.yarnrc
.yarnrc.yml
.pnpmfile.cjs
`;

  if (!content.includes('pnpm-lock.yaml')) {
    // Find a good place to insert (after node_modules or at the beginning)
    if (content.includes('node_modules/')) {
      content = content.replace('node_modules/', `node_modules/${packageManagerSection}`);
    } else {
      content = packageManagerSection + '\n' + content;
    }
    
    fs.writeFileSync(gitignorePath, content);
    success('Updated .gitignore to exclude pnpm/yarn artifacts');
  } else {
    log('.gitignore already configured to exclude pnpm/yarn artifacts');
  }
}

function ensurePackageLock() {
  const packageLockPath = path.join(process.cwd(), 'package-lock.json');
  
  if (!fs.existsSync(packageLockPath)) {
    // Create minimal package-lock.json that npm will populate
    const minimalLock = {
      "name": "word-sprint-game-fuweav",
      "version": "1.0.0",
      "lockfileVersion": 3,
      "requires": true,
      "packages": {}
    };
    
    fs.writeFileSync(packageLockPath, JSON.stringify(minimalLock, null, 2));
    success('Created minimal package-lock.json');
  } else {
    log('package-lock.json already exists');
  }
}

function main() {
  log('Starting package manager cleanup...');
  
  removePnpmArtifacts();
  updateGitignore();
  ensurePackageLock();
  
  success('Package manager cleanup completed!');
  log('Project is now configured to use npm exclusively.');
  log('Run "npm install" to ensure dependencies are properly installed.');
}

if (require.main === module) {
  main();
}

module.exports = { removePnpmArtifacts, updateGitignore, ensurePackageLock };
