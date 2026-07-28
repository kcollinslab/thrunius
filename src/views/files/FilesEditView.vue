<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'

const route = useRoute()
const router = useRouter()

const FILE_MANAGER_ROLES = ['admin', 'editor']

const loading = ref(true)
const saving = ref(false)
const loadingError = ref('')
const feedback = ref({ type: '', message: '' })
const formSubmitted = ref(false)
const previewFailed = ref(false)
const saveRedirectTimer = ref(null)

const fileData = ref({
  title: '',
  description: '',
  alt_text: '',
  keywords: '',
  is_main: false,
})

const fileMeta = ref(null)

const keywordCount = computed(() => normalizeKeywords(fileData.value.keywords).length)
const fileTypeLabel = computed(() => {
  const extension = fileMeta.value?.extension?.toUpperCase()
  return extension || 'ARCHIVO'
})
const canShowPreview = computed(() => Boolean(fileMeta.value?.is_image && !previewFailed.value))

onMounted(fetchFileData)

onBeforeUnmount(() => {
  if (saveRedirectTimer.value) clearTimeout(saveRedirectTimer.value)
})

async function assertFileManager() {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('AUTH_REQUIRED')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  const role = String(profile?.role || '').trim().toLowerCase()
  if (profileError || !FILE_MANAGER_ROLES.includes(role)) {
    throw new Error('MANAGER_REQUIRED')
  }

  return userData.user
}

async function fetchFileData() {
  loading.value = true
  loadingError.value = ''
  feedback.value = { type: '', message: '' }
  previewFailed.value = false

  try {
    await assertFileManager()

    const { data, error } = await supabase
      .from('files')
      .select(`
        id,
        bucket_id,
        file_name,
        extension,
        storage_path,
        mime_type,
        size_bytes,
        is_image,
        width,
        height,
        title,
        description,
        alt_text,
        keywords,
        is_main,
        posts (title)
      `)
      .eq('id', route.params.id)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('FILE_NOT_FOUND')

    fileMeta.value = data
    fileData.value = {
      title: data.title || '',
      description: data.description || '',
      alt_text: data.alt_text || '',
      keywords: Array.isArray(data.keywords) ? data.keywords.join(', ') : '',
      is_main: Boolean(data.is_main),
    }
  } catch (error) {
    console.error('Error al cargar el archivo:', error)
    loadingError.value = getLoadErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function updateFile() {
  if (saving.value) return

  formSubmitted.value = true
  feedback.value = { type: '', message: '' }

  if (!fileData.value.title.trim()) return

  saving.value = true

  try {
    const currentUser = await assertFileManager()
    const { data, error } = await supabase
      .from('files')
      .update({
        title: fileData.value.title.trim(),
        description: fileData.value.description.trim() || null,
        alt_text: fileData.value.alt_text.trim() || null,
        keywords: normalizeKeywords(fileData.value.keywords),
        is_main: fileData.value.is_main,
        updater_id: currentUser.id,
      })
      .eq('id', route.params.id)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data?.id) throw new Error('FILE_NOT_UPDATED')

    feedback.value = { type: 'success', message: 'Metadatos actualizados correctamente.' }
    saveRedirectTimer.value = setTimeout(() => router.push('/files'), 1000)
  } catch (error) {
    console.error('Error al actualizar el archivo:', error)
    feedback.value = { type: 'danger', message: getSaveErrorMessage(error) }
  } finally {
    saving.value = false
  }
}

function normalizeKeywords(value) {
  return String(value || '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean)
}

function getFileUrl(path) {
  if (!path) return ''
  return supabase.storage
    .from(fileMeta.value?.bucket_id || 'media')
    .getPublicUrl(path).data.publicUrl
}

function getRelationshipTitle() {
  if (Array.isArray(fileMeta.value?.posts)) return fileMeta.value.posts[0]?.title || ''
  return fileMeta.value?.posts?.title || ''
}

function formatSize(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const size = value / (1024 ** unitIndex)
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function getLoadErrorMessage(error) {
  if (error?.message === 'AUTH_REQUIRED') return 'Tu sesión terminó. Inicia sesión nuevamente.'
  if (error?.message === 'MANAGER_REQUIRED') return 'No tienes permisos para editar archivos.'
  if (error?.message === 'FILE_NOT_FOUND') return 'No se encontró el archivo o no tienes acceso a él.'
  return 'No se pudo cargar el archivo.'
}

function getSaveErrorMessage(error) {
  if (error?.message === 'AUTH_REQUIRED') return 'Tu sesión terminó. Inicia sesión nuevamente.'
  if (error?.message === 'MANAGER_REQUIRED') return 'No tienes permisos para editar archivos.'
  if (error?.message === 'FILE_NOT_UPDATED') return 'No se encontró el archivo o no se pudo actualizar.'
  return error?.message || 'No se pudieron actualizar los metadatos.'
}
</script>

<template>
  <div class="container py-3 edit-file-view">
    <div class="row justify-content-center">
      <div class="col-12 col-xxl-10">
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border text-dark" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p class="text-muted small mt-3 mb-0">Cargando archivo...</p>
        </div>

        <div v-else-if="loadingError" class="edit-state-card text-center">
          <i class="bi bi-file-earmark-x" aria-hidden="true"></i>
          <h1 class="h5 mb-2">No se pudo abrir el archivo</h1>
          <p class="text-muted mb-4">{{ loadingError }}</p>
          <div class="d-flex flex-column flex-sm-row justify-content-center gap-2">
            <button type="button" class="btn btn-dark px-4" @click="fetchFileData">
              Reintentar
            </button>
            <router-link to="/files" class="btn btn-light border px-4">
              Volver a archivos
            </router-link>
          </div>
        </div>

        <div v-else class="edit-file-card">
          <div class="card-body p-3 p-lg-4">
            <div
              v-if="feedback.message"
              class="alert alert-dismissible fade show d-flex align-items-start gap-2"
              :class="`alert-${feedback.type}`"
              role="alert"
            >
              <i
                class="bi flex-shrink-0 mt-1"
                :class="feedback.type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'"
                aria-hidden="true"
              ></i>
              <div>{{ feedback.message }}</div>
              <button
                type="button"
                class="btn-close"
                aria-label="Cerrar mensaje"
                @click="feedback.message = ''"
              ></button>
            </div>

            <form novalidate @submit.prevent="updateFile">
              <section class="form-section border-bottom pb-4 mb-4">
                <div class="d-flex flex-column flex-lg-row justify-content-between gap-2 mb-3">
                  <div>
                    <p class="section-kicker mb-1">Archivo</p>
                    <h3 class="section-title mb-0">Vista previa e información</h3>
                  </div>
                  <a
                    :href="getFileUrl(fileMeta?.storage_path)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-light border compact-link align-self-start"
                  >
                    <i class="bi bi-box-arrow-up-right me-2" aria-hidden="true"></i>
                    Ver original
                  </a>
                </div>

                <div class="file-context">
                  <div class="preview-box" aria-hidden="true">
                    <img
                      v-if="canShowPreview"
                      :src="getFileUrl(fileMeta?.storage_path)"
                      alt=""
                      @error="previewFailed = true"
                    >
                    <div v-else class="file-placeholder">
                      <i class="bi bi-file-earmark-text" aria-hidden="true"></i>
                      <span>{{ fileTypeLabel }}</span>
                    </div>
                  </div>

                  <div class="file-context-body">
                    <h4 class="file-name text-break mb-2">{{ fileMeta?.file_name }}</h4>
                    <dl class="technical-list mb-0">
                      <div>
                        <dt>Formato</dt>
                        <dd>{{ fileTypeLabel }}</dd>
                      </div>
                      <div>
                        <dt>Tamaño</dt>
                        <dd>{{ formatSize(fileMeta?.size_bytes) }}</dd>
                      </div>
                      <div v-if="fileMeta?.width && fileMeta?.height">
                        <dt>Dimensiones</dt>
                        <dd>{{ fileMeta.width }} × {{ fileMeta.height }} px</dd>
                      </div>
                      <div>
                        <dt>Tipo MIME</dt>
                        <dd class="text-break">{{ fileMeta?.mime_type || 'No disponible' }}</dd>
                      </div>
                      <div>
                        <dt>Relación</dt>
                        <dd>{{ getRelationshipTitle() || 'Archivo general' }}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </section>

              <section class="form-section border-bottom pb-4 mb-4">
                <div class="d-flex flex-column flex-lg-row justify-content-between gap-2 mb-3">
                  <div>
                    <p class="section-kicker mb-1">Contenido principal</p>
                    <h3 class="section-title mb-0">Título y descripción</h3>
                  </div>
                </div>

                <div class="mb-3">
                  <div class="d-flex justify-content-between gap-3">
                    <label class="form-label fw-semibold" for="file-title">Título <span class="text-danger">*</span></label>
                    <span class="form-hint">{{ fileData.title.length }} caracteres</span>
                  </div>
                  <input
                    id="file-title"
                    v-model="fileData.title"
                    type="text"
                    class="form-control form-control-lg"
                    :class="{ 'is-invalid': formSubmitted && !fileData.title.trim() }"
                    maxlength="160"
                    placeholder="Escribe un título descriptivo"
                    :disabled="saving"
                    required
                  >
                  <div class="invalid-feedback">El título es obligatorio.</div>
                </div>

                <div>
                  <label class="form-label fw-semibold" for="file-description">Descripción</label>
                  <textarea
                    id="file-description"
                    v-model="fileData.description"
                    class="form-control"
                    rows="4"
                    placeholder="Explica el contenido y el uso previsto del archivo"
                    :disabled="saving"
                  ></textarea>
                  <div class="form-text">Ayuda a identificar el archivo dentro de la biblioteca.</div>
                </div>
              </section>

              <section class="form-section mb-4">
                <div class="mb-3">
                  <p class="section-kicker mb-1">Búsqueda</p>
                  <h3 class="section-title mb-0">Accesibilidad y etiquetas</h3>
                </div>

                <div class="row g-3">
                  <div v-if="fileMeta?.is_image" class="col-12 col-lg-6">
                    <label class="form-label fw-semibold" for="file-alt">Texto alternativo</label>
                    <input
                      id="file-alt"
                      v-model="fileData.alt_text"
                      type="text"
                      class="form-control"
                      placeholder="Describe brevemente lo que muestra la imagen"
                      :disabled="saving"
                    >
                    <div class="form-text">Mejora la accesibilidad cuando la imagen no puede verse.</div>
                  </div>

                  <div class="col-12" :class="fileMeta?.is_image ? 'col-lg-6' : 'col-lg-8'">
                    <div class="d-flex justify-content-between gap-3">
                      <label class="form-label fw-semibold" for="file-keywords">Palabras clave</label>
                      <span class="form-hint">{{ keywordCount }} etiquetas</span>
                    </div>
                    <input
                      id="file-keywords"
                      v-model="fileData.keywords"
                      type="text"
                      class="form-control"
                      placeholder="campaña, portada, institucional"
                      :disabled="saving"
                    >
                    <div class="form-text">Separa cada palabra clave con una coma.</div>
                  </div>
                </div>

                <div class="form-check form-switch main-file-switch mt-4">
                  <input
                    id="file-main"
                    v-model="fileData.is_main"
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    :disabled="saving"
                  >
                  <label class="form-check-label fw-semibold" for="file-main">Archivo principal</label>
                </div>
              </section>

              <div class="form-actions border-top pt-3">
                <div class="action-stack">
                  <button type="submit" class="btn btn-dark px-4" :disabled="saving">
                    <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                    {{ saving ? 'Guardando...' : 'Guardar cambios' }}
                  </button>
                  <router-link
                    to="/files"
                    class="btn btn-light border px-4"
                    :class="{ disabled: saving }"
                    :aria-disabled="saving"
                    :tabindex="saving ? -1 : undefined"
                    @click="saving && $event.preventDefault()"
                  >
                    Cancelar
                  </router-link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-file-view {
  min-height: calc(100vh - 4rem);
}

.edit-file-card {
  border-radius: 0.5em;
}

.edit-file-card > .card-body,
.edit-state-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #ffffff;
  box-shadow: 0 0.5rem 1.5rem rgba(17, 24, 39, 0.06);
}

.edit-state-card {
  padding: clamp(2rem, 6vw, 4rem) 1.25rem;
}

.edit-state-card > i {
  display: block;
  margin-bottom: 1rem;
  color: #9ca3af;
  font-size: 2.5rem;
}

.section-kicker {
  color: #6c757d;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.section-title {
  color: #111827;
  font-size: 1rem;
  font-weight: 700;
}

.form-hint {
  color: #6c757d;
  flex-shrink: 0;
  font-size: 0.8rem;
}

.form-control,
.btn {
  border-radius: 0.5em;
}

.form-control:focus,
.form-check-input:focus {
  border-color: #212529;
  box-shadow: 0 0 0 0.2rem rgba(33, 37, 41, 0.12);
}

.form-check-input:checked {
  border-color: #212529;
  background-color: #212529;
}

.compact-link {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}

.file-context {
  display: grid;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 0.625rem;
  background: #ffffff;
  grid-template-columns: minmax(12rem, 18rem) minmax(0, 1fr);
}

.preview-box {
  display: flex;
  min-height: 12rem;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-right: 1px solid #e5e7eb;
  background: #f8f9fa;
}

.preview-box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.file-placeholder {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 0.5rem;
  color: #6c757d;
}

.file-placeholder i {
  font-size: 2.75rem;
}

.file-placeholder span {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.file-context-body {
  min-width: 0;
  padding: 1rem 1.25rem;
}

.file-name {
  color: #212529;
  font-size: 0.95rem;
  font-weight: 700;
}

.technical-list {
  display: grid;
  gap: 0.75rem 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.technical-list > div {
  min-width: 0;
}

.technical-list dt {
  margin-bottom: 0.15rem;
  color: #6c757d;
  font-size: 0.72rem;
  font-weight: 600;
}

.technical-list dd {
  margin: 0;
  color: #212529;
  font-size: 0.825rem;
  font-weight: 600;
}

.main-file-switch {
  color: #495057;
}

.form-actions .btn {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
  padding-bottom: 0.625rem;
  padding-top: 0.625rem;
}

.form-actions {
  position: sticky;
  bottom: 0;
  z-index: 1;
  margin-inline: -0.25rem;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 -0.5rem 1rem rgba(255, 255, 255, 0.9);
}

.action-stack {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
  width: min(100%, 22rem);
  margin-left: auto;
}

.action-stack .btn {
  flex: 1 1 0;
}

.form-actions .btn-dark {
  background: #111827;
}

.form-actions .spinner-border {
  flex-shrink: 0;
}

@media (max-width: 767.98px) {
  .file-context {
    grid-template-columns: 1fr;
  }

  .preview-box {
    min-height: 9rem;
    border-right: 0;
    border-bottom: 1px solid #e5e7eb;
  }
}

@media (max-width: 575.98px) {
  .technical-list {
    grid-template-columns: 1fr;
  }

  .action-stack {
    width: 100%;
  }
}
</style>
