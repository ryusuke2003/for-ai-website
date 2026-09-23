import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  bumpPatchVersion,
  bumpVersion,
  cargoUpdateArguments,
  formatCargoUpdateError,
  incrementPatchVersion,
  incrementVersion,
  readLockedPackageVersion,
  replaceCargoPackageVersion,
} from './version-app.mjs';

const temporaryDirectories = [];

function createVersionFixture() {
  const rootDir = mkdtempSync(join(tmpdir(), 'version-app-test-'));
  const tauriDir = join(rootDir, 'src-tauri');
  mkdirSync(tauriDir);
  writeFileSync(join(tauriDir, 'tauri.conf.json'), `${JSON.stringify({ version: '0.1.1' }, null, 2)}\n`);
  writeFileSync(join(tauriDir, 'Cargo.toml'), '[package]\nname = "one-desktop"\nversion = "0.1.0"\n');
  writeFileSync(join(tauriDir, 'Cargo.lock'), 'version = 4\n\n[[package]]\nname = "one-desktop"\nversion = "0.1.0"\n');
  temporaryDirectories.push(rootDir);
  return rootDir;
}

function readVersionFiles(rootDir) {
  return {
    tauriConfig: readFileSync(join(rootDir, 'src-tauri/tauri.conf.json'), 'utf8'),
    cargoToml: readFileSync(join(rootDir, 'src-tauri/Cargo.toml'), 'utf8'),
    cargoLock: readFileSync(join(rootDir, 'src-tauri/Cargo.lock'), 'utf8'),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('version-app', () => {
  it('patch versionを1つ上げる', () => {
    expect(incrementPatchVersion('0.1.1')).toBe('0.1.2');
    expect(incrementPatchVersion('2.9.99')).toBe('2.9.100');
  });

  it('patch / minor / majorをSemVerとして更新する', () => {
    expect(incrementVersion('1.2.3', 'patch')).toBe('1.2.4');
    expect(incrementVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(incrementVersion('1.2.3', 'major')).toBe('2.0.0');
  });

  it('未対応のversion bumpは拒否する', () => {
    expect(() => incrementVersion('1.2.3', 'banana')).toThrow('Unsupported version bump: banana');
  });

  it('semver形式でないversionは拒否する', () => {
    expect(() => incrementPatchVersion('v0.1.1')).toThrow('Unsupported version');
  });

  it('Cargo.tomlのpackage versionだけを更新する', () => {
    const source = '[package]\nname = "one-desktop"\nversion = "0.1.0"\n\n[dependencies]\ntauri = "2"\n';
    expect(replaceCargoPackageVersion(source, '0.1.2')).toContain('name = "one-desktop"\nversion = "0.1.2"');
  });

  it('Cargo.lockからone-desktopのversionを取得する', () => {
    const source = '[[package]]\nname = "one-desktop"\nversion = "0.1.2"\ndependencies = [\n "tauri",\n]\n';
    expect(readLockedPackageVersion(source)).toBe('0.1.2');
  });

  it('Cargo自身で対象packageだけを指定versionへ更新する引数を組み立てる', () => {
    expect(cargoUpdateArguments('/tmp/app/Cargo.toml', '0.1.2')).toEqual([
      'update',
      '--manifest-path',
      '/tmp/app/Cargo.toml',
      '--package',
      'one-desktop',
      '--precise',
      '0.1.2',
    ]);
  });

  it('Cargo失敗時はstderrをトラブルシュート用に整形する', () => {
    expect(formatCargoUpdateError({ stderr: 'error: package ID specification did not match\n' })).toBe(
      'cargo update failed:\nerror: package ID specification did not match',
    );
    expect(formatCargoUpdateError(new Error('cargo command could not start'))).toBe(
      'cargo update failed: cargo command could not start',
    );
  });

  it('patch versionを上げてTauri設定・Cargo.toml・Cargo.lockを同期する', () => {
    const rootDir = createVersionFixture();

    const result = bumpPatchVersion({
      rootDir,
      runCargo: ({ cargoLockPath, nextVersion }) => {
        const current = readFileSync(cargoLockPath, 'utf8');
        writeFileSync(cargoLockPath, current.replace('version = "0.1.0"', `version = "${nextVersion}"`));
      },
    });

    expect(result).toEqual({ currentVersion: '0.1.1', nextVersion: '0.1.2' });
    expect(JSON.parse(readFileSync(join(rootDir, 'src-tauri/tauri.conf.json'), 'utf8')).version).toBe('0.1.2');
    expect(readFileSync(join(rootDir, 'src-tauri/Cargo.toml'), 'utf8')).toContain('version = "0.1.2"');
    expect(readLockedPackageVersion(readFileSync(join(rootDir, 'src-tauri/Cargo.lock'), 'utf8'))).toBe('0.1.2');
  });

  it('minor versionでも3ファイルを同期する', () => {
    const rootDir = createVersionFixture();

    const result = bumpVersion({
      rootDir,
      releaseType: 'minor',
      runCargo: ({ cargoLockPath, nextVersion }) => {
        const current = readFileSync(cargoLockPath, 'utf8');
        writeFileSync(cargoLockPath, current.replace('version = "0.1.0"', `version = "${nextVersion}"`));
      },
    });

    expect(result).toEqual({ currentVersion: '0.1.1', nextVersion: '0.2.0' });
    expect(JSON.parse(readFileSync(join(rootDir, 'src-tauri/tauri.conf.json'), 'utf8')).version).toBe('0.2.0');
    expect(readFileSync(join(rootDir, 'src-tauri/Cargo.toml'), 'utf8')).toContain('version = "0.2.0"');
    expect(readLockedPackageVersion(readFileSync(join(rootDir, 'src-tauri/Cargo.lock'), 'utf8'))).toBe('0.2.0');
  });

  it('Cargo処理が失敗した場合は3ファイルすべてを実行前の状態へ戻す', () => {
    const rootDir = createVersionFixture();
    const originalFiles = readVersionFiles(rootDir);

    expect(() => bumpPatchVersion({
      rootDir,
      runCargo: ({ cargoLockPath }) => {
        writeFileSync(cargoLockPath, 'partially updated lockfile\n');
        throw new Error('cargo update failed');
      },
    })).toThrow('cargo update failed');

    expect(readVersionFiles(rootDir)).toEqual(originalFiles);
  });

  it('Cargo.lockが期待したversionにならなければ失敗して3ファイルを戻す', () => {
    const rootDir = createVersionFixture();
    const originalFiles = readVersionFiles(rootDir);

    expect(() => bumpPatchVersion({
      rootDir,
      runCargo: () => {},
    })).toThrow('Cargo.lock version did not update to 0.1.2 (actual: 0.1.0)');

    expect(readVersionFiles(rootDir)).toEqual(originalFiles);
  });
});
