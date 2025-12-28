import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const corePkgPath = path.join(root, 'packages', 'core', 'package.json');

const runNumber = process.env.GITHUB_RUN_NUMBER ?? '0';
const sha = (process.env.GITHUB_SHA ?? 'dev').slice(0, 7);

const pkg = JSON.parse(fs.readFileSync(corePkgPath, 'utf8'));
const base = String(pkg.version ?? '0.0.0').split('-')[0]; // drop any existing prerelease
const nextVersion = `${base}-next.${runNumber}.${sha}`;

pkg.version = nextVersion;
fs.writeFileSync(corePkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

console.log(`@cazala/party version set to ${nextVersion}`);


