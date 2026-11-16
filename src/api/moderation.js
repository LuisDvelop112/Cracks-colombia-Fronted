import { request } from './http'

/** Pending videos, oldest first. Only the VERIFICADOR role may call it. */
export function getModerationQueue({ page = 0, size = 10 } = {}) {
  return request(`/moderation/queue?${new URLSearchParams({ page, size })}`)
}
