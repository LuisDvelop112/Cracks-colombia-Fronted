<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VideoPlayer from '../components/VideoPlayer.vue'
import { getModerationQueue } from '../api/moderation'
import { formatBytes, formatDateTime, formatDuration } from '../utils/format'

const PAGE_SIZE = 10

const route = useRoute()
const router = useRouter()

const page = ref(0)
const result = ref({ items: [], page: 0, totalPages: 0, totalElements: 0 })
const loading = ref(true)
const error = ref('')

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const data = await getModerationQueue({ page: page.value, size: PAGE_SIZE })
    if (seq !== requestSeq) return
    // Videos moderated meanwhile can leave this page empty; fall back to the last one.
    if (data.items.length === 0 && page.value > 0 && data.totalPages > 0) {
      goTo(data.totalPages - 1)
      return
    }
    result.value = data
  } catch (e) {
    if (seq === requestSeq) error.value = e.message
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

// The page lives in the URL so reloading keeps the verifier's place in the queue.
watch(
  () => route.query.pagina,
  (value) => {
    page.value = Number(value ?? 0) || 0
    load()
  },
  { immediate: true },
)

function goTo(nextPage) {
  router.replace({ query: nextPage > 0 ? { pagina: String(nextPage) } : {} })
}
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1>Bandeja de verificación</h1>
        <p class="lead" style="margin: 0">Videos pendientes, del más antiguo al más reciente.</p>
      </div>
      <button type="button" class="btn btn-ghost" :disabled="loading" @click="load">Actualizar</button>
    </div>

    <div class="stack" aria-live="polite">
      <div class="pager">
        <span>
          <b style="color: var(--text)">{{ result.totalElements }}</b>
          video{{ result.totalElements === 1 ? '' : 's' }} pendiente{{ result.totalElements === 1 ? '' : 's' }}
        </span>
        <span v-if="loading">Cargando…</span>
        <span v-else-if="result.totalPages">Página {{ result.page + 1 }} de {{ result.totalPages }}</span>
      </div>

      <p v-if="error" class="alert alert-error" role="alert">{{ error }}</p>
      <div v-else-if="!loading && result.items.length === 0" class="card empty">
        No hay videos pendientes de revisión.
      </div>
      <div v-else class="video-grid">
        <article v-for="(video, index) in result.items" :key="video.id" class="card video-card">
          <VideoPlayer :content-path="video.url" load-label="Reproducir" />
          <div class="video-card-body">
            <div class="row" style="justify-content: space-between">
              <span class="hint">#{{ result.page * result.size + index + 1 }} en la fila</span>
              <span v-if="video.minor" class="badge badge-PENDIENTE">Menor de edad</span>
            </div>
            <h3 style="margin: 0">{{ video.athleteFullName }}</h3>
            <p class="video-meta">
              <template v-if="video.athleteAge !== null">{{ video.athleteAge }} años</template>
              <template v-if="video.athleteAge !== null && video.sport"> · </template>
              <template v-if="video.sport">{{ video.sport }}</template>
            </p>
            <p class="video-meta">
              Subido el {{ formatDateTime(video.uploadedAt) }}<br />
              {{ formatDuration(video.durationSeconds) }} · {{ formatBytes(video.sizeBytes) }}
            </p>
          </div>
        </article>
      </div>

      <div v-if="result.totalPages > 1" class="row" style="justify-content: center">
        <button type="button" class="btn btn-ghost" :disabled="page === 0 || loading" @click="goTo(page - 1)">Anterior</button>
        <button type="button" class="btn btn-ghost" :disabled="page + 1 >= result.totalPages || loading" @click="goTo(page + 1)">Siguiente</button>
      </div>
    </div>
  </section>
</template>
