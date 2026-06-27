import fs from 'node:fs/promises';
import path from 'node:path';
import { maskObject } from '../security/redaction.mjs';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export class JsonlStore {
  constructor({ storageDir, maskLogs = true }) {
    this.storageDir = storageDir;
    this.maskLogs = maskLogs;
  }

  async append(name, record) {
    await ensureDir(this.storageDir);
    const filePath = path.join(this.storageDir, `${name}.jsonl`);
    const payload = this.maskLogs ? maskObject(record) : record;
    await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
    return payload;
  }

  async readAll(name, { limit = 200 } = {}) {
    const filePath = path.join(this.storageDir, `${name}.jsonl`);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content
        .trim()
        .split('\n')
        .filter(Boolean)
        .slice(-limit)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
}
