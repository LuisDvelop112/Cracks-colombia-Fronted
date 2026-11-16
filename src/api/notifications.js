import { request } from './http'

export function listNotifications() {
  return request('/notifications?unreadOnly=false')
}

export function markNotificationRead(notificationId) {
  return request(`/notifications/${notificationId}/read`, { method: 'PATCH' })
}
