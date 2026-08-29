import { randomUUID } from 'node:crypto'

export function requestId(request, response, next) {
  request.id = request.get('x-request-id')?.slice(0, 100) || randomUUID()
  response.set('x-request-id', request.id)
  next()
}
