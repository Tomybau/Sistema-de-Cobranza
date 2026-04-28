import fs from "fs/promises"
import path from "path"

// ─── Interface ────────────────────────────────────────────────────────────────

export interface StorageAdapter {
  save(key: string, buffer: Buffer, contentType: string): Promise<void>
  getUrl(key: string): string
  getBuffer(key: string): Promise<Buffer>
}

// ─── Local filesystem adapter (dev) ──────────────────────────────────────────

class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string

  constructor() {
    this.baseDir = process.env.STORAGE_LOCAL_PATH ?? "./uploads"
  }

  private fullPath(key: string): string {
    // Sanitize: evitar path traversal
    const safe = key.replace(/\.\./g, "").replace(/^\//, "")
    return path.join(this.baseDir, safe)
  }

  async save(key: string, buffer: Buffer, _contentType: string): Promise<void> {
    const filePath = this.fullPath(key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  }

  getUrl(key: string): string {
    const safe = key.replace(/\.\./g, "").replace(/^\//, "")
    return `/api/files/${safe}`
  }

  async getBuffer(key: string): Promise<Buffer> {
    const filePath = this.fullPath(key)
    return fs.readFile(filePath)
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _storage: StorageAdapter | null = null

export function getStorage(): StorageAdapter {
  if (!_storage) {
    // En el futuro: if (process.env.STORAGE_PROVIDER === "s3") return new S3Adapter()
    _storage = new LocalStorageAdapter()
  }
  return _storage
}
