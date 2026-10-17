// Publishes the current tree to GitHub as one commit on master, so the local history (the dev branch) stays private,
// and pushes the version tag on it: GitHub Actions builds the installer and publishes the release.
// Bumps the patch version first (a local commit and tag); `-- minor` / `-- major` bump the other parts,
// `-- --no-bump` publishes the current version.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REMOTE = 'origin';
const BRANCH = 'master';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

if (git('status', '--porcelain')) throw new Error('Commit or stash the changes first');

if (!process.argv.includes('--no-bump')) {
    const part = ['major', 'minor', 'patch'].find(p => process.argv.includes(p)) ?? 'patch';
    execFileSync('npm', ['version', part, '-m', '%s'], { stdio: 'inherit', shell: true });
}

const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const tag = `v${version}`;

// Local tags point to the private history, so tags are never fetched and the public one is checked on the remote
if (git('ls-remote', '--tags', REMOTE, tag)) throw new Error(`${tag} is already published`);

const parent = [];
if (git('ls-remote', '--heads', REMOTE, BRANCH)) {
    git('fetch', '--no-tags', REMOTE, BRANCH);
    parent.push('-p', 'FETCH_HEAD');
}

const commit = git('commit-tree', 'HEAD^{tree}', ...parent, '-m', `Unity Runway ${version}`);
execFileSync('git', ['push', REMOTE, `${commit}:refs/heads/${BRANCH}`, `${commit}:refs/tags/${tag}`], { stdio: 'inherit' });
console.log(`Published ${tag} as ${commit}`);
