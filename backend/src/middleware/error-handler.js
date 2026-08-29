import { Prisma } from '@prisma/client'
import multer from 'multer'
import { ApiError } from '../lib/api-error.js'

export function notFound(request, _response, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `Route ${request.method} ${request.path} was not found`))
}

export function errorHandler(error, request, response, _next) {
  if (error instanceof multer.MulterError) {
    const fileTooLarge = error.code === 'LIMIT_FILE_SIZE'
    response.status(fileTooLarge ? 413 : 400).json({
      error: {
        code: fileTooLarge ? 'FILE_TOO_LARGE' : 'INVALID_MULTIPART_UPLOAD',
        message: fileTooLarge ? 'The image exceeds the configured upload limit' : error.message,
        requestId: request.id,
      },
    })
    return
  }

  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: request.id,
      },
    })
    return
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    response.status(409).json({
      error: {
        code: 'RESOURCE_CONFLICT',
        message: 'A resource with the same unique value already exists',
        requestId: request.id,
      },
    })
    return
  }

  console.error(`[${request.id}]`, error)
  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      requestId: request.id,
    },
  })
}
