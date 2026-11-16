<script setup>
import { onMounted, reactive, ref } from 'vue'
import VideoPlayer from '../components/VideoPlayer.vue'
import { approveVideo, listModerationQueue, rejectVideo } from '../api/moderation'
import { formatDateTime, formatDuration } from '../utils/format'

const PAGE_SIZE = 20
const REASON_MAX = 500

const queue = ref({ items: [], page: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0, first: true, last: true })
const page = ref(0)
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

async function load(target = page.value) {
  loading.value = true
  error.value = ''
  try {
    let data = await listModerationQueue({ page: target, size: PAGE_SIZE })
    if (data.items.length === 0 && data.page > 0) {
      data = await listModerationQueue({ page: data.page - 1, size: PAGE_SIZE })
    }
    for (const item of data.items) {
      if (reasons[item.id] === undefined) reasons[item.id] = ''
    }
    queue.value = data
    page.value = data.page
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function dropResolved(id) {
  delete reasons[id]
  delete locked[id]
  return load(page.value)
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

onMounted(() => load(0))
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1>Verificador</h1>
        <p class="lead" style="margin: 0">
          Revisa los videos pendientes, del más antiguo al más reciente. Prioriza a los deportistas menores de edad.
        </p>
      </div>
    </div>

    <div class="stack" aria-live="polite">
      <div class="pager">
        <span><b style="color: var(--text)">{{ queue.totalElements }}</b> pendiente{{ queue.totalElements === 1 ? '' : 's' }}</span>
        <span v-if="loading">Cargando…</span>
        <span v-else-if="queue.totalPages">Página {{ queue.page + 1 }} de {{ queue.totalPages }}</span>
      </div>

      <p v-if="error" class="alert alert-error" role="alert">{{ error }}</p>
      <div v-if="!loading && queue.items.length === 0 && !error" class="card empty">
        No hay videos pendientes de revisión.
      </div>

      <div class="moderation-list">
      <article v-for="item in queue.items" :key="item.id" class="card video-card">
        <VideoPlayer :content-path="item.url" :is-public="false" />
        <div class="video-card-body">
          <div class="row">
            <h2 style="margin: 0">{{ item.athleteFullName }}</h2>
            <span class="badge">{{ item.athleteAge }} años</span>
            <span v-if="item.minor" class="badge badge-RECHAZADO">Menor de edad</span>
          </div>
          <p class="video-meta">
            {{ item.sport || 'Deporte sin registrar' }} · {{ formatDuration(item.durationSeconds) }} ·
            Cargado {{ formatDateTime(item.uploadedAt) }}
          </p>

          <p v-if="locked[item.id]" class="alert alert-error" role="alert">{{ locked[item.id] }}</p>
          <form v-else class="stack" @submit.prevent="reject(item)">
            <div class="row">
              <button type="button" class="btn btn-primary btn-small" :disabled="busyId === item.id" @click="approve(item)">
                {{ busyId === item.id ? 'Guardando…' : 'Aprobar' }}
              </button>
            </div>
            <div class="field">
              <label :for="`reason-${item.id}`">Motivo del rechazo</label>
              <textarea
                :id="`reason-${item.id}`"
                v-model="reasons[item.id]"
                :maxlength="REASON_MAX"
                placeholder="Explica por qué este video no puede publicarse."
              ></textarea>
              <p class="hint">{{ reasonOf(item.id).trim().length }}/{{ REASON_MAX }}. El motivo es obligatorio.</p>
            </div>
            <div>
              <button type="submit" class="btn btn-danger-outline btn-small" :disabled="busyId === item.id || Boolean(reasonError(item.id))">
                Rechazar
              </button>
            </div>
          </form>
        </div>
      </article>
      </div>

      <div v-if="queue.totalPages > 1" class="row" style="justify-content: center">
        <button type="button" class="btn btn-ghost" :disabled="queue.first || loading" @click="load(page - 1)">Anterior</button>
        <button type="button" class="btn btn-ghost" :disabled="queue.last || loading" @click="load(page + 1)">Siguiente</button>
      </div>
    </div>
  </section>
</template>
