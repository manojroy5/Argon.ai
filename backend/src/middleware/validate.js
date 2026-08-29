import { ApiError } from '../lib/api-error.js'

export function validate(schema, location = 'body') {
  return (request, _response, next) => {
    const result = schema.safeParse(request[location])

    if (!result.success) {
      next(new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed', result.error.flatten()))
      return
    }

    request.validated = {
      ...request.validated,
      [location]: result.data,
    }
    next()
  }
}
