<script setup>
import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VideoPlayer from '../components/VideoPlayer.vue'
import { approveVideo, listModerationQueue, rejectVideo } from '../api/moderation'
import { formatBytes, formatDateTime, formatDuration } from '../utils/format'

const PAGE_SIZE = 20
const REASON_MAX = 500

const route = useRoute()
const router = useRouter()

const page = ref(0)
const result = ref({ items: [], page: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0, first: true, last: true })
const loading = ref(true)
const error = ref('')
const busyId = ref(null)
const reasons = reactive({})
const locked = reactive({})

function reasonOf(id) {
  return reasons[id] ?? ''
}

function reasonError(id) {
  const text = reasonOf(id).trim()
  if (!text) return 'El motivo es obligatorio.'
  if (text.length > REASON_MAX) return `El motivo no puede superar ${REASON_MAX} caracteres.`
  return ''
}

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    let data = await listModerationQueue({ page: page.value, size: PAGE_SIZE })
    if (seq !== requestSeq) return
    if (data.items.length === 0 && page.value > 0 && data.totalPages > 0) {
      goTo(data.totalPages - 1)
      return
    }
    for (const item of data.items) {
      if (reasons[item.id] === undefined) reasons[item.id] = ''
    }
    result.value = data
  } catch (e) {
    if (seq === requestSeq) error.value = e.message
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

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

function dropResolved(id) {
  delete reasons[id]
  delete locked[id]
  return load()
}

async function approve(item) {
  if (locked[item.id] || busyId.value) return
  busyId.value = item.id
  error.value = ''
  try {
    await approveVideo(item.id)
    await dropResolved(item.id)
  } catch (e) {
    if (e.status === 409) locked[item.id] = e.message
    else error.value = e.message
  } finally {
    busyId.value = null
  }
}

async function reject(item) {
  if (locked[item.id] || busyId.value) return
  const problem = reasonError(item.id)
  if (problem) {
    error.value = problem
    return
  }
  busyId.value = item.id
  error.value = ''
  try {
    await rejectVideo(item.id, reasonOf(item.id).trim())
    await dropResolved(item.id)
  } catch (e) {
    if (e.status === 409) locked[item.id] = e.message
    else error.value = e.message
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1>Bandeja de verificación</h1>
        <p class="lead" style="margin: 0">
          Videos pendientes, del más antiguo al más reciente. Prioriza a los deportistas menores de edad.
        </p>
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
      <div v-else class="moderation-list">
        <article v-for="(video, index) in result.items" :key="video.id" class="card video-card">
          <VideoPlayer :content-path="video.url" load-label="Reproducir" />
          <div class="video-card-body">
            <div class="row">
              <span class="hint">#{{ result.page * (result.size || PAGE_SIZE) + index + 1 }} en la fila</span>
              <span v-if="video.minor" class="badge badge-RECHAZADO">Menor de edad</span>
            </div>
            <h2 style="margin: 0">{{ video.athleteFullName }}</h2>
            <p class="video-meta">
              <template v-if="video.athleteAge != null">{{ video.athleteAge }} años</template>
              <template v-if="video.sport"> · {{ video.sport }}</template>
              <template v-else> · Deporte sin registrar</template>
              · {{ formatDuration(video.durationSeconds) }} · {{ formatBytes(video.sizeBytes) }}
              · Subido el {{ formatDateTime(video.uploadedAt) }}
            </p>

            <p v-if="locked[video.id]" class="alert alert-error" role="alert">{{ locked[video.id] }}</p>
            <form v-else class="stack" @submit.prevent="reject(video)">
              <div class="row">
                <button type="button" class="btn btn-primary btn-small" :disabled="busyId === video.id" @click="approve(video)">
                  {{ busyId === video.id ? 'Guardando…' : 'Aprobar' }}
                </button>
              </div>
              <div class="field">
                <label :for="`reason-${video.id}`">Motivo del rechazo</label>
                <textarea
                  :id="`reason-${video.id}`"
                  v-model="reasons[video.id]"
                  :maxlength="REASON_MAX"
                  placeholder="Explica por qué este video no puede publicarse."
                ></textarea>
                <p class="hint">{{ reasonOf(video.id).trim().length }}/{{ REASON_MAX }}. El motivo es obligatorio.</p>
              </div>
              <div>
                <button type="submit" class="btn btn-danger-outline btn-small" :disabled="busyId === video.id || Boolean(reasonError(video.id))">
                  Rechazar
                </button>
              </div>
            </form>
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
