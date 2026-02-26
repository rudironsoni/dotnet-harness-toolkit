/**
 * Plugin build script
 * Copies generated OpenCode content into the plugin's bundled/ directory
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const BUNDLED_DIR = path.join(__dirname, '..', 'bundled');

/**
 * Main build function
 */
async function build() {
  console.log('Building OpenCode plugin...');
  
  // Clean and create bundled directory
  if (fs.existsSync(BUNDLED_DIR)) {
    fs.rmSync(BUNDLED_DIR, { recursive: true });
  }
  fs.mkdirSync(BUNDLED_DIR, { recursive: true });
  
  // Generate OpenCode output first
  console.log('Generating OpenCode output...');
  const { execSync } = require('child_process');
  execSync('npx rulesync generate --targets opencode --features "*"', {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
  
  // Copy agents
  const opencodeAgents = path.join(PROJECT_ROOT, '.opencode', 'agent');
  if (fs.existsSync(opencodeAgents)) {
    const bundledAgents = path.join(BUNDLED_DIR, 'agents');
    fs.mkdirSync(bundledAgents, { recursive: true });
    copyDir(opencodeAgents, bundledAgents);
    console.log(`Copied agents: ${fs.readdirSync(opencodeAgents).length} files`);
  }
  
  // Copy skills
  const opencodeSkills = path.join(PROJECT_ROOT, '.opencode', 'skills');
  if (fs.existsSync(opencodeSkills)) {
    const bundledSkills = path.join(BUNDLED_DIR, 'skills');
    fs.mkdirSync(bundledSkills, { recursive: true });
    copyDir(opencodeSkills, bundledSkills);
    console.log(`Copied skills: ${fs.readdirSync(opencodeSkills).length} directories`);
  }
  
  // Copy rules
  const opencodeRules = path.join(PROJECT_ROOT, '.opencode', 'rules');
  if (fs.existsSync(opencodeRules)) {
    const bundledRules = path.join(BUNDLED_DIR, 'rules');
    fs.mkdirSync(bundledRules, { recursive: true });
    copyDir(opencodeRules, bundledRules);
    console.log(`Copied rules: ${fs.readdirSync(opencodeRules).length} files`);
  }
  
  // Copy commands
  const opencodeCommands = path.join(PROJECT_ROOT, '.opencode', 'commands');
  if (fs.existsSync(opencodeCommands)) {
    const bundledCommands = path.join(BUNDLED_DIR, 'commands');
    fs.mkdirSync(bundledCommands, { recursive: true });
    copyDir(opencodeCommands, bundledCommands);
    console.log(`Copied commands: ${fs.readdirSync(opencodeCommands).length} files`);
  }
  
  // Copy hooks
  const opencodeHooks = path.join(PROJECT_ROOT, '.opencode', 'hooks');
  if (fs.existsSync(opencodeHooks)) {
    const bundledHooks = path.join(BUNDLED_DIR, 'hooks');
    fs.mkdirSync(bundledHooks, { recursive: true });
    copyDir(opencodeHooks, bundledHooks);
    console.log(`Copied hooks: ${fs.readdirSync(opencodeHooks).length} files`);
  }
  
  console.log('Build complete!');
}

function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
