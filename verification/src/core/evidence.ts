import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * Stores run evidence (screenshots, DOM snapshots, HTTP traces, logs) in a
 * timestamped directory per challenge run. All report evidence entries are
 * relative paths from the run directory root.
 */
export class EvidenceStore {
  private readonly rootDir: string;
  private readonly challenge: string;
  private readonly stamp: string;
  private _dir: string | null = null;

  constructor(rootDir: string, challenge: string, stamp: string) {
    this.rootDir = rootDir;
    this.challenge = challenge;
    this.stamp = stamp;
  }

  /** Absolute path of this run's evidence directory. */
  get dir(): string {
    if (this._dir === null) {
      this._dir = path.join(this.rootDir, this.challenge, this.stamp);
    }
    return this._dir;
  }

  /** Evidence directory path relative to the output root (for the report). */
  get relativeDir(): string {
    return path.posix.join(this.challenge, this.stamp).replaceAll('\\', '/');
  }

  /** Ensures the evidence directory exists. */
  async ensure(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  /** Absolute path for a relative evidence name. */
  resolve(name: string): string {
    return path.join(this.dir, name);
  }

  /** Saves text evidence; returns the path relative to the run dir. */
  async saveText(name: string, text: string): Promise<string> {
    await this.ensure();
    await fs.writeFile(this.resolve(name), text, 'utf8');
    return name;
  }

  /** Saves binary evidence; returns the path relative to the run dir. */
  async saveBinary(name: string, data: Uint8Array): Promise<string> {
    await this.ensure();
    await fs.writeFile(this.resolve(name), data);
    return name;
  }

  /** Saves a pretty JSON blob as evidence. */
  async saveJson(name: string, value: unknown): Promise<string> {
    return this.saveText(name, `${JSON.stringify(value, null, 2)}\n`);
  }
}
