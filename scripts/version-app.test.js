import { describe, expect, it } from 'vitest';
import { incrementPatchVersion, readLockedPackageVersion, replaceCargoPackageVersion } from './version-app.mjs';

describe('version-app', () => {
  it('patch versionを1つ上げる', () => {
    expect(incrementPatchVersion('0.1.1')).toBe('0.1.2');
    expect(incrementPatchVersion('2.9.99')).toBe('2.9.100');
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
});
