import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const corePkgPath = path.join(root, 'packages', 'core', 'package.json');

const rawTag = process.env.RELEASE_TAG;
if (!rawTag) {
  console.error('Missing RELEASE_TAG env var (expected e.g. v0.1.0 or 0.1.0).');
  process.exit(1);
}

const version = rawTag.startsWith('v') ? rawTag.slice(1) : rawTag;
if (!/^\d+\.\d+\.\d+([\-+].+)?$/.test(version)) {
  console.error(`RELEASE_TAG "${rawTag}" does not look like a semver tag.`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(corePkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(corePkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

console.log(`@cazala/party version set to ${version}`);


