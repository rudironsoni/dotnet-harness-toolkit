#!/usr/bin/env node
/**
 * Update all skills with hierarchical tags
 *
 * Usage: node update-skill-tags.js [--dry-run]
 *
 * This script:
 * 1. Scans all skills in .rulesync/skills/
 * 2. Analyzes content to determine appropriate category
 * 3. Adds hierarchical tags (e.g., dotnet/testing/xunit)
 * 4. Updates frontmatter in-place
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const SKILLS_DIR = '.rulesync/skills';
const DRY_RUN = process.argv.includes('--dry-run');

// Category detection patterns
const categoryPatterns = {
  'dotnet/csharp': [/csharp|C#|\/\/.*language|syntax|nullable|async.*await/i],
  'dotnet/testing': [/xunit|nunit|mstest|test|mock|fixture|assert/i],
  'dotnet/data': [/ef.?core|entity.?framework|dapper|ado\.net|database|dbcontext|repository/i],
  'dotnet/ui': [/blazor|maui|wpf|winui|winforms|uno|razor|component|render/i],
  'dotnet/cloud': [/azure|aws|gcp|kubernetes|docker|container|aspire|orchestration/i],
  'dotnet/security': [/auth|oauth|jwt|identity|security|owasp|encryption|cryptography/i],
  'dotnet/performance': [/performance|optimization|benchmark|aot|trimming|memory|span|gc/i],
  'dotnet/architecture': [/architecture|pattern|clean|vertical.?slice|cqrs|event.?sourcing|ddd/i],
  'dotnet/api': [/api|rest|grpc|minimal.?api|controller|openapi|swagger|endpoint/i],
  'dotnet/messaging': [/message|queue|event|signalr|kafka|rabbitmq|service.?bus/i],
  'dotnet/devops': [/ci.?cd|github.?actions|azure.?devops|pipeline|deployment|release/i],
  'dotnet/ai': [/semantic.?kernel|ai|ml|openai|llm|agent|vector/i],
  'dotnet/cli': [/cli|command.?line|system\.commandline|spectre/i],
  'dotnet/tooling': [/rulesync|eslint|analyzer|source.?generator|roslyn/i],
  'wiki/documentation': [/wiki|documentation|llms\.txt|agents\.md|onboard|changelog/i],
  general: [/deep.?research|research/i],
};

// Function to detect category from skill content
function detectCategory(skillName, content) {
  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(content) || pattern.test(skillName)) {
        return category;
      }
    }
  }

  // Default based on skill name prefix
  if (skillName.startsWith('dotnet-')) return 'dotnet';
  if (skillName.startsWith('wiki-')) return 'wiki/documentation';
  if (skillName.startsWith('deep-')) return 'general';

  return 'general';
}

// Main function
function main() {
  const skillsDir = path.resolve(SKILLS_DIR);

  if (!fs.existsSync(skillsDir)) {
    console.error(`Skills directory not found: ${skillsDir}`);
    process.exit(1);
  }

  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Updating skill tags in ${SKILLS_DIR}...\n`);

  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  // Process skills
  const skills = fs
    .readdirSync(skillsDir, { recursive: true })
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(skillsDir, file));

  console.log(`Found ${skills.length} skill files\n`);

  for (const skillPath of skills) {
    try {
      const content = fs.readFileSync(skillPath, 'utf-8');
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);

      if (!frontmatterMatch) {
        console.log(`⚠ No frontmatter: ${path.basename(skillPath)}`);
        errors++;
        continue;
      }

      const frontmatter = YAML.parse(frontmatterMatch[1]);
      if (!frontmatter.name) {
        console.log(`⚠ No name: ${path.basename(skillPath)}`);
        errors++;
        continue;
      }

      const category = detectCategory(frontmatter.name, content);
      const existingTags = frontmatter.tags || [];
      const newTags = new Set(existingTags);

      if (!existingTags.some(tag => tag.startsWith(category.split('/')[0]))) {
        newTags.add(category);
      }

      if (!newTags.has('dotnet') && category.startsWith('dotnet/')) {
        newTags.add('dotnet');
      }

      const tagsArray = Array.from(newTags).sort();

      if (JSON.stringify(existingTags.sort()) !== JSON.stringify(tagsArray)) {
        if (!DRY_RUN) {
          frontmatter.tags = tagsArray;
          const newFrontmatter = YAML.stringify(frontmatter, { lineWidth: 120, noRefs: true });
          const newContent = `---\n${newFrontmatter}---\n${content.substring(frontmatterMatch[0].length)}`;
          fs.writeFileSync(skillPath, newContent);
        }
        console.log(
          `✓ ${path.basename(skillPath)}: ${existingTags.join(', ') || '(none)'} → ${tagsArray.join(', ')}`
        );
        updated++;
      } else {
        unchanged++;
      }
    } catch (e) {
      console.log(`✗ Error processing ${path.basename(skillPath)}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Summary:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${skills.length}`);
}

main();
