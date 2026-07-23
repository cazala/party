import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillPath = resolve(skillDir, "SKILL.md");
const skill = await readFile(skillPath, "utf8");
const match = skill.match(/^---\n([\s\S]*?)\n---\n/);

if (!match) throw new Error("SKILL.md must start with YAML frontmatter");

const keys = match[1]
  .split("\n")
  .filter((line) => /^[a-z][a-z0-9_-]*:/.test(line))
  .map((line) => line.slice(0, line.indexOf(":")));

if (keys.join(",") !== "name,description") {
  throw new Error("SKILL.md frontmatter must contain only name and description");
}

if (!/^name: party$/m.test(match[1])) {
  throw new Error("Skill name must be party");
}

const localLinks = [...skill.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
  .map((result) => result[1])
  .filter((link) => !link.includes(":") && !link.startsWith("#"));

await Promise.all(localLinks.map((link) => access(resolve(skillDir, link))));

const repoPackagePath = resolve(skillDir, "../..", "package.json");
try {
  const repoPackage = JSON.parse(await readFile(repoPackagePath, "utf8"));
  if (repoPackage.name === "party") {
    try {
      await access(resolve(skillDir, "../..", "SKILL.md"));
      throw new Error(
        "Keep one canonical skill: remove the duplicate repository-root SKILL.md"
      );
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        // Expected: packages/skill is the only entry point.
      } else {
        throw error;
      }
    }
  }
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
    throw error;
  }
}

console.log(`Validated Party skill (${localLinks.length} local links)`);
