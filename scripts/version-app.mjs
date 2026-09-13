import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function incrementPatchVersion(version) {
  const match = VERSION_PATTERN.exec(version);
  if (!match) throw new Error(`Unsupported version: ${version}`);
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
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

export function bumpPatchVersion({ rootDir = process.cwd(), runCargo } = {}) {
  const tauriConfigPath = resolve(rootDir, 'src-tauri/tauri.conf.json');
  const cargoTomlPath = resolve(rootDir, 'src-tauri/Cargo.toml');
  const cargoLockPath = resolve(rootDir, 'src-tauri/Cargo.lock');

  const originalTauriConfig = readFileSync(tauriConfigPath, 'utf8');
  const originalCargoToml = readFileSync(cargoTomlPath, 'utf8');
  const originalCargoLock = readFileSync(cargoLockPath, 'utf8');
  const tauriConfig = JSON.parse(originalTauriConfig);
  const currentVersion = tauriConfig.version;
  const nextVersion = incrementPatchVersion(currentVersion);

  const executeCargo = runCargo ?? (() => {
    execFileSync(
      'cargo',
      ['metadata', '--manifest-path', 'src-tauri/Cargo.toml', '--format-version', '1', '--no-deps'],
      { cwd: rootDir, stdio: 'inherit' },
    );
  });

  try {
    tauriConfig.version = nextVersion;
    writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);
    writeFileSync(cargoTomlPath, replaceCargoPackageVersion(originalCargoToml, nextVersion));

    executeCargo();

    const lockedVersion = readLockedPackageVersion(readFileSync(cargoLockPath, 'utf8'));
    if (lockedVersion !== nextVersion) {
      throw new Error(`Cargo.lock version did not update to ${nextVersion} (actual: ${lockedVersion ?? 'missing'})`);
    }
  } catch (error) {
    writeFileSync(tauriConfigPath, originalTauriConfig);
    writeFileSync(cargoTomlPath, originalCargoToml);
    writeFileSync(cargoLockPath, originalCargoLock);
    throw error;
  }

  return { currentVersion, nextVersion };
}

function main() {
  const { currentVersion, nextVersion } = bumpPatchVersion();
  console.log(`Tauri app version: ${currentVersion} -> ${nextVersion}`);
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
