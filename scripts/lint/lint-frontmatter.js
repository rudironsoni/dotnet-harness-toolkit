#!/usr/bin/env node
/**
 * RuleSync-aware frontmatter linter
 * Validates YAML frontmatter in .rulesync/ markdown files
 *
 * Checks:
 * - Required fields per file type
 * - Platform-specific blocks match conventions
 * - Skill references exist
 * - Tool profile consistency
 * - Frontmatter field ordering
 * - File naming conventions (kebab-case)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import YAML from 'yaml';

// Configuration
const RULESYNC_DIR = '.rulesync';
const SKILLS_DIR = join(RULESYNC_DIR, 'skills');
const SUBAGENTS_DIR = join(RULESYNC_DIR, 'subagents');
const RULES_DIR = join(RULESYNC_DIR, 'rules');
const COMMANDS_DIR = join(RULESYNC_DIR, 'commands');

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;

// Statistics
const stats = {
  filesChecked: 0,
  errors: [],
  warnings: [],
  fixed: 0,
};

// Field ordering for different file types
const FIELD_ORDER = {
  skills: ['name', 'description', 'targets', 'tags', 'version', 'author'],
  subagents: ['name', 'description', 'targets', 'tags', 'version', 'author'],
  rules: ['root', 'localRoot', 'targets', 'description', 'globs'],
  commands: ['description', 'targets'],
};

// Required fields per file type
const REQUIRED_FIELDS = {
  skills: ['name', 'description', 'targets'],
  subagents: ['name', 'description', 'targets'],
  rules: ['targets', 'description'],
  commands: ['description', 'targets'],
};

// Banned fields at top level (must be in platform blocks)
const BANNED_TOP_LEVEL_FIELDS = ['tools', 'model', 'mode'];

// Valid tool names per platform
const VALID_TOOLS = {
  claudecode: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
  opencode: ['bash', 'edit', 'write'],
  copilot: ['read', 'search', 'execute', 'edit'],
};

// Skill/subagent reference regex: [skill:name] or [subagent:name]
const SKILL_REF_REGEX = /\[skill:([^\]]+)\]/g;
const SUBAGENT_REF_REGEX = /\[subagent:([^\]]+)\]/g;

/**
 * Extract frontmatter from markdown file
 * @param {string} content - File content
 * @returns {Object|null} Parsed frontmatter or null
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  try {
    return YAML.parse(match[1]);
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Check if a string is kebab-case
 * @param {string} str - String to check
 * @returns {boolean}
 */
function isKebabCase(str) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(str);
}

/**
 * Get all skill names from skills directory
 * @returns {Set<string>}
 */
function getSkillNames() {
  const skills = new Set();

  if (!existsSync(SKILLS_DIR)) return skills;

  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      skills.add(entry.name);
    }
  }

  return skills;
}

/**
 * Get all subagent names from subagents directory
 * @returns {Set<string>}
 */
function getSubagentNames() {
  const subagents = new Set();

  if (!existsSync(SUBAGENTS_DIR)) return subagents;

  const entries = readdirSync(SUBAGENTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      // Remove .md extension to get subagent name
      subagents.add(entry.name.replace(/\.md$/, ''));
    }
  }

  return subagents;
}

/**
 * Validate skill references in content
 * @param {string} content - File content
 * @param {string} filePath - Path to file
 * @param {Set<string>} validSkills - Set of valid skill names
 * @param {Set<string>} validSubagents - Set of valid subagent names
 */
function validateSkillReferences(content, filePath, validSkills, validSubagents) {
  // Combine skills and subagents - both are valid targets for [skill:] references
  const validRefs = new Set([...validSkills, ...validSubagents]);

  const refs = content.matchAll(SKILL_REF_REGEX);
  for (const match of refs) {
    const refName = match[1];
    if (!validRefs.has(refName)) {
      stats.errors.push({
        file: filePath,
        line: content.substring(0, match.index).split('\n').length,
        message: `Invalid skill/subagent reference: "${refName}" does not exist`,
      });
    }
  }

  // Also validate explicit [subagent:] references
  const subagentRefs = content.matchAll(SUBAGENT_REF_REGEX);
  for (const match of subagentRefs) {
    const subagentName = match[1];
    if (!validSubagents.has(subagentName)) {
      stats.errors.push({
        file: filePath,
        line: content.substring(0, match.index).split('\n').length,
        message: `Invalid subagent reference: "${subagentName}" does not exist`,
      });
    }
  }
}

/**
 * Validate frontmatter field ordering
 * @param {Object} frontmatter - Parsed frontmatter
 * @param {string} fileType - Type of file (skills, subagents, etc.)
 * @param {string} filePath - Path to file
 */
function validateFieldOrder(frontmatter, fileType, filePath) {
  const expectedOrder = FIELD_ORDER[fileType];
  if (!expectedOrder) return;

  const actualFields = Object.keys(frontmatter).filter(f => !f.startsWith('_'));
  const orderedFields = expectedOrder.filter(f => actualFields.includes(f));

  for (let i = 0; i < orderedFields.length - 1; i++) {
    const currentIdx = actualFields.indexOf(orderedFields[i]);
    const nextIdx = actualFields.indexOf(orderedFields[i + 1]);

    if (currentIdx > nextIdx && nextIdx !== -1) {
      stats.warnings.push({
        file: filePath,
        message: `Field "${orderedFields[i + 1]}" should come before "${orderedFields[i]}" (recommended order: ${expectedOrder.join(', ')})`,
      });
    }
  }
}

/**
 * Validate subagent tool profiles
 * @param {Object} frontmatter - Parsed frontmatter
 * @param {string} filePath - Path to file
 */
function validateToolProfiles(frontmatter, filePath) {
  const platforms = ['claudecode', 'opencode', 'copilot'];

  for (const platform of platforms) {
    if (!frontmatter[platform]) continue;

    const config = frontmatter[platform];

    // Validate claudecode tools
    if (platform === 'claudecode' && config['allowed-tools']) {
      for (const tool of config['allowed-tools']) {
        if (!VALID_TOOLS.claudecode.includes(tool)) {
          stats.errors.push({
            file: filePath,
            message: `Invalid tool "${tool}" in claudecode.allowed-tools`,
          });
        }
      }
    }

    // Validate opencode tools
    if (platform === 'opencode' && config.tools) {
      for (const tool of Object.keys(config.tools)) {
        if (!VALID_TOOLS.opencode.includes(tool)) {
          stats.errors.push({
            file: filePath,
            message: `Invalid tool "${tool}" in opencode.tools`,
          });
        }
      }
    }

    // Validate copilot tools
    if (platform === 'copilot' && config.tools) {
      for (const tool of config.tools) {
        if (!VALID_TOOLS.copilot.includes(tool)) {
          stats.errors.push({
            file: filePath,
            message: `Invalid tool "${tool}" in copilot.tools`,
          });
        }
      }
    }
  }
}

/**
 * Validate a single file
 * @param {string} filePath - Path to file
 * @param {string} fileType - Type of file
 * @param {Set<string>} validSkills - Set of valid skill names
 * @param {Set<string>} validSubagents - Set of valid subagent names
 */
function validateFile(filePath, fileType, validSkills, validSubagents) {
  stats.filesChecked++;

  const content = readFileSync(filePath, 'utf-8');
  const frontmatter = extractFrontmatter(content);

  if (!frontmatter) {
    stats.errors.push({
      file: filePath,
      message: 'Missing or invalid YAML frontmatter',
    });
    return;
  }

  if (frontmatter.error) {
    stats.errors.push({
      file: filePath,
      message: `YAML parsing error: ${frontmatter.error}`,
    });
    return;
  }

  // Check required fields
  const required = REQUIRED_FIELDS[fileType] || [];
  for (const field of required) {
    if (!(field in frontmatter)) {
      stats.errors.push({
        file: filePath,
        message: `Missing required field: "${field}"`,
      });
    }
  }

  // Check for banned fields at top level
  for (const field of BANNED_TOP_LEVEL_FIELDS) {
    if (field in frontmatter) {
      stats.errors.push({
        file: filePath,
        message: `Banned field "${field}" at top level. Must be inside platform block (claudecode, opencode, etc.)`,
      });
    }
  }

  // Validate field ordering
  validateFieldOrder(frontmatter, fileType, filePath);

  // Validate tool profiles (for subagents)
  if (fileType === 'subagents') {
    validateToolProfiles(frontmatter, filePath);
  }

  // Validate skill references
  validateSkillReferences(content, filePath, validSkills, validSubagents);
}

/**
 * Recursively find all markdown files in directory
 * @param {string} dir - Directory to search
 * @param {string[]} files - Accumulator array
 * @returns {string[]}
 */
function findMarkdownFiles(dir, files = []) {
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      findMarkdownFiles(fullPath, files);
    } else if (entry.isFile() && extname(entry.name) === '.md') {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main validation function
 */
function main() {
  const validSkills = getSkillNames();
  const validSubagents = getSubagentNames();
  console.log(`Found ${validSkills.size} skills in catalog`);
  console.log(`Found ${validSubagents.size} subagents in catalog\n`);

  // Validate skills
  console.log('Validating skills...');
  const skillFiles = findMarkdownFiles(SKILLS_DIR);
  for (const file of skillFiles) {
    if (basename(file) === 'SKILL.md') {
      validateFile(file, 'skills', validSkills, validSubagents);

      // Check kebab-case naming
      const skillName = basename(file.replace('/SKILL.md', ''));
      if (!isKebabCase(skillName)) {
        stats.warnings.push({
          file,
          message: `Skill directory "${skillName}" should use kebab-case (e.g., "${skillName.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')}")`,
        });
      }
    }
  }

  // Validate subagents
  console.log('Validating subagents...');
  const subagentFiles = findMarkdownFiles(SUBAGENTS_DIR);
  for (const file of subagentFiles) {
    validateFile(file, 'subagents', validSkills, validSubagents);

    // Check kebab-case naming
    const fileName = basename(file, '.md');
    if (!isKebabCase(fileName)) {
      stats.warnings.push({
        file,
        message: `Subagent file "${fileName}" should use kebab-case`,
      });
    }
  }

  // Validate rules
  console.log('Validating rules...');
  const ruleFiles = findMarkdownFiles(RULES_DIR);
  for (const file of ruleFiles) {
    validateFile(file, 'rules', validSkills, validSubagents);
  }

  // Validate commands
  console.log('Validating commands...');
  const commandFiles = findMarkdownFiles(COMMANDS_DIR);
  for (const file of commandFiles) {
    validateFile(file, 'commands', validSkills, validSubagents);
  }

  // Report results
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Files checked: ${stats.filesChecked}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`Warnings: ${stats.warnings.length}`);
  console.log(`${'='.repeat(70)}\n`);

  if (stats.errors.length > 0) {
    console.log('ERRORS:');
    for (const error of stats.errors) {
      console.log(`  ❌ ${error.file}${error.line ? `:${error.line}` : ''}`);
      console.log(`     ${error.message}\n`);
    }
  }

  if (stats.warnings.length > 0) {
    console.log('WARNINGS:');
    for (const warning of stats.warnings) {
      console.log(`  ⚠️  ${warning.file}${warning.line ? `:${warning.line}` : ''}`);
      console.log(`     ${warning.message}\n`);
    }
  }

  if (stats.errors.length === 0 && stats.warnings.length === 0) {
    console.log('✅ All files passed validation!\n');
    process.exit(EXIT_SUCCESS);
  } else if (stats.errors.length === 0) {
    console.log('✅ No errors, but warnings present.\n');
    process.exit(EXIT_SUCCESS);
  } else {
    console.log('❌ Validation failed. Please fix errors above.\n');
    process.exit(EXIT_ERROR);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { extractFrontmatter, validateFile, getSkillNames };
