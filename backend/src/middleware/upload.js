import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { config } from '../config.js'
import { storageDirectories } from '../lib/storage.js'

const uploadStorage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, storageDirectories.temporary),
  filename: (_request, _file, callback) => callback(null, `${randomUUID()}.upload`),
})

export const uploadSingleImage = multer({
  storage: uploadStorage,
  limits: {
    fileSize: config.MAX_FILE_SIZE_BYTES,
    files: 1,
    fields: 0,
    parts: 2,
  },
}).single('file')
