import sharp from 'sharp'

export async function createDifferenceHash(imageBuffer) {
  const { data } = await sharp(imageBuffer)
    .resize(9, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let bits = 0n
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      bits <<= 1n
      if (data[(row * 9) + column] > data[(row * 9) + column + 1]) bits |= 1n
    }
  }
  return bits.toString(16).padStart(16, '0')
}

export function hammingDistance(firstHash, secondHash) {
  let difference = BigInt(`0x${firstHash}`) ^ BigInt(`0x${secondHash}`)
  let distance = 0
  while (difference) {
    distance += 1
    difference &= difference - 1n
  }
  return distance
}

export async function calculateBlurVariance(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let count = 0
  let sum = 0
  let sumOfSquares = 0
  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const index = (y * info.width) + x
      const laplacian = (4 * data[index])
        - data[index - 1]
        - data[index + 1]
        - data[index - info.width]
        - data[index + info.width]
      count += 1
      sum += laplacian
      sumOfSquares += laplacian * laplacian
    }
  }
  if (!count) return 0
  const mean = sum / count
  return (sumOfSquares / count) - (mean * mean)
}
