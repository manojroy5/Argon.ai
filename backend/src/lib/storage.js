import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'

export const storageDirectories = Object.freeze({
  root: config.STORAGE_ROOT,
  temporary: path.join(config.STORAGE_ROOT, 'temporary'),
  originals: path.join(config.STORAGE_ROOT, 'originals'),
  processed: path.join(config.STORAGE_ROOT, 'processed'),
})

export async function ensureStorageDirectories() {
  await Promise.all(Object.values(storageDirectories).map((directory) => (
    mkdir(directory, { recursive: true })
  )))
}

export function resolveStorageKey(storageKey) {
  const resolved = path.resolve(config.STORAGE_ROOT, storageKey)
  const relative = path.relative(config.STORAGE_ROOT, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Unsafe storage key')
  }
  return resolved
}

export async function commitTemporaryFile(temporaryPath, storageKey) {
  const targetPath = resolveStorageKey(storageKey)
  await mkdir(path.dirname(targetPath), { recursive: true })
  await rename(temporaryPath, targetPath)
  return targetPath
}

export async function removeStoredFile(storageKey) {
  if (!storageKey) return
  await rm(resolveStorageKey(storageKey), { force: true })
}
