import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import cvModule from '@techstark/opencv-js'

const CASCADE_FILENAME = 'haarcascade_frontalface_default.xml'
const cascadePath = fileURLToPath(new URL(`../assets/${CASCADE_FILENAME}`, import.meta.url))
let classifierPromise

async function initializeClassifier() {
  const cv = cvModule instanceof Promise ? await cvModule : cvModule
  if (!cv.Mat) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('OpenCV initialization timed out')), 30_000)
      cv.onRuntimeInitialized = () => {
        clearTimeout(timeout)
        resolve()
      }
    })
  }
  const cascadeBytes = await readFile(cascadePath)
  try {
    cv.FS_unlink(`/${CASCADE_FILENAME}`)
  } catch {
    // The virtual file does not exist on the first initialization.
  }
  cv.FS_createDataFile('/', CASCADE_FILENAME, cascadeBytes, true, false, false)
  const classifier = new cv.CascadeClassifier()
  if (!classifier.load(CASCADE_FILENAME)) {
    classifier.delete()
    throw new Error('OpenCV could not load the frontal-face cascade')
  }
  return { cv, classifier }
}

async function getClassifier() {
  classifierPromise ??= initializeClassifier()
  return classifierPromise
}

export async function detectFaces(grayscalePixels, width, height) {
  const { cv, classifier } = await getClassifier()
  const image = cv.matFromArray(height, width, cv.CV_8UC1, grayscalePixels)
  const faces = new cv.RectVector()
  const minimumFace = new cv.Size(30, 30)

  try {
    cv.equalizeHist(image, image)
    classifier.detectMultiScale(image, faces, 1.1, 5, 0, minimumFace)
    return Array.from({ length: faces.size() }, (_, index) => {
      const face = faces.get(index)
      return { x: face.x, y: face.y, width: face.width, height: face.height }
    })
  } finally {
    faces.delete()
    image.delete()
  }
}
