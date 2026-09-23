import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const VERSION_BUMP_TYPES = new Set(['patch', 'minor', 'major']);
const CARGO_PACKAGE_NAME = 'one-desktop';

export function incrementVersion(version, releaseType = 'patch') {
  const match = VERSION_PATTERN.exec(version);
  if (!match) throw new Error(`Unsupported version: ${version}`);
  if (!VERSION_BUMP_TYPES.has(releaseType)) {
    throw new Error(`Unsupported version bump: ${releaseType}`);
  }

  const [, majorText, minorText, patchText] = match;
  const major = Number(majorText);
  const minor = Number(minorText);
  const patch = Number(patchText);

  if (releaseType === 'major') return `${major + 1}.0.0`;
  if (releaseType === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function incrementPatchVersion(version) {
  return incrementVersion(version, 'patch');
}

export function replaceCargoPackageVersion(source, nextVersion) {
  const packageBlock = /(\[package\][\s\S]*?\nversion = ")[^"]+("[\s\S]*)/;
  if (!packageBlock.test(source)) throw new Error('Cargo.toml package version was not found');
  return source.replace(packageBlock, `$1${nextVersion}$2`);
}

export function readLockedPackageVersion(source, packageName = 'one-desktop') {
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\[\\[package\\]\\]\\nname = "${escapedName}"\\nversion = "([^"]+)"`).exec(source);
  return match?.[1] ?? null;
}

export function cargoUpdateArguments(manifestPath, nextVersion, packageName = CARGO_PACKAGE_NAME) {
  return [
    'update',
    '--manifest-path',
    manifestPath,
    '--package',
    packageName,
    '--precise',
    nextVersion,
  ];
}

export function formatCargoUpdateError(error) {
  const stderr = error && typeof error === 'object' && 'stderr' in error
    ? error.stderr
    : null;
  const cargoDetail = typeof stderr === 'string'
    ? stderr.trim()
    : Buffer.isBuffer(stderr)
      ? stderr.toString('utf8').trim()
      : '';

  if (cargoDetail) return `cargo update failed:\n${cargoDetail}`;
  const fallback = error instanceof Error ? error.message : String(error);
  return `cargo update failed: ${fallback}`;
}

function updateCargoLock({ rootDir, manifestPath, nextVersion }) {
  try {
    execFileSync(
      'cargo',
      cargoUpdateArguments(manifestPath, nextVersion),
      {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } catch (error) {
    throw new Error(formatCargoUpdateError(error), { cause: error });
  }
}

export function setAppVersion({
  rootDir = process.cwd(),
  runCargo,
  targetVersion,
} = {}) {
  if (!VERSION_PATTERN.test(targetVersion ?? '')) {
    throw new Error(`Unsupported version: ${targetVersion}`);
  }

  const tauriConfigPath = resolve(rootDir, 'src-tauri/tauri.conf.json');
  const cargoTomlPath = resolve(rootDir, 'src-tauri/Cargo.toml');
  const cargoLockPath = resolve(rootDir, 'src-tauri/Cargo.lock');

  const originalTauriConfig = readFileSync(tauriConfigPath, 'utf8');
  const originalCargoToml = readFileSync(cargoTomlPath, 'utf8');
  const originalCargoLock = readFileSync(cargoLockPath, 'utf8');
  const tauriConfig = JSON.parse(originalTauriConfig);
  const currentVersion = tauriConfig.version;

  const executeCargo = runCargo ?? updateCargoLock;

  try {
    tauriConfig.version = targetVersion;
    writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);
    writeFileSync(cargoTomlPath, replaceCargoPackageVersion(originalCargoToml, targetVersion));

    executeCargo({
      rootDir,
      manifestPath: cargoTomlPath,
      cargoLockPath,
      nextVersion: targetVersion,
    });

    const lockedVersion = readLockedPackageVersion(readFileSync(cargoLockPath, 'utf8'), CARGO_PACKAGE_NAME);
    if (lockedVersion !== targetVersion) {
      throw new Error(`Cargo.lock version did not update to ${targetVersion} (actual: ${lockedVersion ?? 'missing'})`);
    }
  } catch (error) {
    writeFileSync(tauriConfigPath, originalTauriConfig);
    writeFileSync(cargoTomlPath, originalCargoToml);
    writeFileSync(cargoLockPath, originalCargoLock);
    throw error;
  }

  return { currentVersion, nextVersion: targetVersion };
}

export function bumpVersion({
  rootDir = process.cwd(),
  runCargo,
  releaseType = 'patch',
  baseVersion,
} = {}) {
  const tauriConfigPath = resolve(rootDir, 'src-tauri/tauri.conf.json');
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'));
  const currentVersion = baseVersion ?? tauriConfig.version;
  const nextVersion = incrementVersion(currentVersion, releaseType);

  setAppVersion({
    rootDir,
    runCargo,
    targetVersion: nextVersion,
  });

  return { currentVersion, nextVersion };
}

export function bumpPatchVersion(options = {}) {
  return bumpVersion({ ...options, releaseType: 'patch' });
}

function main() {
  const command = process.argv[2] ?? 'patch';

  if (command === 'set') {
    const targetVersion = process.argv[3];
    const { currentVersion, nextVersion } = setAppVersion({ targetVersion });
    console.log(`Tauri app version: ${currentVersion} -> ${nextVersion} (set)`);
    console.log('Updated src-tauri/tauri.conf.json, Cargo.toml and Cargo.lock.');
    return;
  }

  const baseVersion = process.argv[3];
  const { currentVersion, nextVersion } = bumpVersion({
    releaseType: command,
    baseVersion,
  });
  console.log(`Tauri app version: ${currentVersion} -> ${nextVersion} (${command})`);
  console.log('Updated src-tauri/tauri.conf.json, Cargo.toml and Cargo.lock.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
