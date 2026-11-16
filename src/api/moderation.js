import { request } from './http'

const PAGE_SIZE = 20

/** Pending videos, oldest first. `page` starts at 0. */
export function listModerationQueue({ page = 0, size = PAGE_SIZE } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  return request(`/moderation/queue?${params}`)
}

/** Moves a pending video to APROBADO. No body. */
export function approveVideo(videoId) {
  return request(`/moderation/${videoId}/approve`, { method: 'POST' })
}

/** Moves a pending video to RECHAZADO. `reason` is required and at most 500 characters. */
export function rejectVideo(videoId, reason) {
  return request(`/moderation/${videoId}/reject`, { method: 'POST', json: { reason } })
}
