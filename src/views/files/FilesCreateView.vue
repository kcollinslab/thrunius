<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const toast = useToast()

const BUCKET_ID = 'media'
const FILE_MANAGER_ROLES = ['admin', 'editor']
const THUMBNAIL_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const fileInput = ref(null)
const titleInput = ref(null)
const selectedFile = ref(null)
const previewUrl = ref('')
const imageDimensions = ref({ width: 0, height: 0 })
const isDragging = ref(false)
const uploading = ref(false)
const fileError = ref('')
const submitError = ref('')

const form = ref({
  title: '',
  description: '',
  alt_text: '',
  keywords: '',
  is_main: false,
})

const fileDetails = computed(() => {
  if (!selectedFile.value) return ''

  const details = [formatSize(selectedFile.value.size)]
  if (imageDimensions.value.width && imageDimensions.value.height) {
    details.push(`${imageDimensions.value.width} × ${imageDimensions.value.height} px`)
  }
  return details.join(' · ')
})

const fileTypeLabel = computed(() => {
  if (!selectedFile.value) return ''
  return getExtension(selectedFile.value.name).toUpperCase()
})

onBeforeUnmount(revokePreview)

function openFilePicker() {
  if (uploading.value || !fileInput.value) return
  fileInput.value.value = ''
  fileInput.value.click()
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (file) selectFile(file)
}

function handleDrop(event) {
  isDragging.value = false
  if (uploading.value) return

  const file = event.dataTransfer?.files?.[0]
  if (file) selectFile(file)
}

function selectFile(file) {
  fileError.value = ''
  submitError.value = ''
  revokePreview()

  selectedFile.value = file
  imageDimensions.value = { width: 0, height: 0 }

  if (!form.value.title.trim()) {
    form.value.title = file.name.replace(/\.[^/.]+$/, '')
  }

  if (!file.type.startsWith('image/')) return

  previewUrl.value = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    imageDimensions.value = {
      width: image.naturalWidth,
      height: image.naturalHeight,
    }
  }
  image.onerror = () => {
    imageDimensions.value = { width: 0, height: 0 }
  }
  image.src = previewUrl.value
}

function removeFile() {
  revokePreview()
  selectedFile.value = null
  imageDimensions.value = { width: 0, height: 0 }
  fileError.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

function revokePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

function formatSize(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const size = value / (1024 ** unitIndex)
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function getExtension(fileName) {
  const match = String(fileName || '').match(/\.([a-z0-9]+)$/i)
  return match?.[1]?.toLowerCase() || 'bin'
}

function createStorageBasePath() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const uniqueId = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return `uploads/${year}/${month}/${uniqueId}`
}

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

function createThumbnail(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('No se pudo crear la miniatura.'))
      image.onload = () => {
        const scale = Math.min(1, 320 / image.naturalWidth)
        const width = Math.max(1, Math.round(image.naturalWidth * scale))
        const height = Math.max(1, Math.round(image.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        if (!context) {
          reject(new Error('No se pudo crear la miniatura.'))
          return
        }

        canvas.width = width
        canvas.height = height
        context.drawImage(image, 0, 0, width, height)
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('No se pudo crear la miniatura.')),
          'image/webp',
          0.76,
        )
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

async function uploadObject(path, body, contentType) {
  const { error } = await supabase.storage
    .from(BUCKET_ID)
    .upload(path, body, {
      cacheControl: '3600',
      contentType,
      upsert: false,
    })

  if (error) throw error
}

async function cleanUploadedObjects(paths) {
  if (!paths.length) return
  const { error } = await supabase.storage.from(BUCKET_ID).remove(paths)
  if (error) console.warn('No se pudieron limpiar los archivos parciales:', error)
}

function validateForm() {
  fileError.value = ''
  submitError.value = ''

  if (!selectedFile.value) {
    fileError.value = 'Selecciona un archivo para continuar.'
    return false
  }

  if (!form.value.title.trim()) {
    titleInput.value?.focus()
    return false
  }

  return true
}

async function uploadFile() {
  if (uploading.value || !validateForm()) return

  uploading.value = true
  const uploadedPaths = []

  try {
    const currentUser = await assertFileManager()
    const file = selectedFile.value
    const extension = getExtension(file.name)
    const mimeType = file.type || 'application/octet-stream'
    const basePath = createStorageBasePath()
    const storagePath = `${basePath}.${extension}`
    let thumbnailPath = null

    await uploadObject(storagePath, file, mimeType)
    uploadedPaths.push(storagePath)

    if (THUMBNAIL_TYPES.has(file.type)) {
      try {
        const thumbnail = await createThumbnail(file)
        const candidatePath = `${basePath}-thumb.webp`
        await uploadObject(candidatePath, thumbnail, 'image/webp')
        thumbnailPath = candidatePath
        uploadedPaths.push(candidatePath)
      } catch (thumbnailError) {
        console.warn('El archivo se guardará sin miniatura:', thumbnailError)
      }
    }

    const keywords = form.value.keywords
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean)

    const { error: databaseError } = await supabase
      .from('files')
      .insert({
        bucket_id: BUCKET_ID,
        file_name: file.name,
        extension,
        storage_path: storagePath,
        thumbnail_path: thumbnailPath,
        mime_type: mimeType,
        size_bytes: file.size,
        is_image: file.type.startsWith('image/'),
        width: imageDimensions.value.width || null,
        height: imageDimensions.value.height || null,
        title: form.value.title.trim(),
        description: form.value.description.trim() || null,
        alt_text: form.value.alt_text.trim() || null,
        keywords,
        is_main: form.value.is_main,
        creator_id: currentUser.id,
        updater_id: currentUser.id,
      })

    if (databaseError) throw databaseError

    toast.success('Archivo subido correctamente.')
    await router.push('/files')
  } catch (error) {
    await cleanUploadedObjects(uploadedPaths)
    console.error('Error al subir el archivo:', error)

    if (error.message === 'AUTH_REQUIRED') {
      toast.error('Tu sesión terminó. Inicia sesión nuevamente.')
      await router.replace('/login')
    } else if (error.message === 'MANAGER_REQUIRED') {
      submitError.value = 'No tienes permisos para subir archivos.'
    } else {
      submitError.value = error.message || 'No se pudo subir el archivo.'
    }
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <main class="container-fluid files-create-page py-2">
    <div class="create-shell">
      <header class="create-header">
        <div class="d-flex align-items-center gap-2">
          <router-link to="/files" class="back-button" aria-label="Volver a archivos">
            <i class="bi bi-arrow-left" aria-hidden="true"></i>
          </router-link>
          <h1 class="h5 fw-bold mb-0">Subir archivo</h1>
        </div>
      </header>

      <section class="card border-0 shadow-sm create-card">
        <form novalidate @submit.prevent="uploadFile">
          <div class="card-body create-card-body">
            <input
              ref="fileInput"
              type="file"
              class="visually-hidden"
              :disabled="uploading"
              @change="handleFileChange"
            >

            <div class="form-layout">
              <section class="upload-panel" aria-labelledby="upload-section-title">
                <h2 id="upload-section-title" class="section-title">Archivo</h2>

                <div
                  v-if="!selectedFile"
                  class="file-picker"
                  :class="{ 'is-dragging': isDragging }"
                  role="button"
                  tabindex="0"
                  @click="openFilePicker"
                  @keydown.enter.prevent="openFilePicker"
                  @keydown.space.prevent="openFilePicker"
                  @dragenter.prevent="isDragging = true"
                  @dragover.prevent="isDragging = true"
                  @dragleave.self.prevent="isDragging = false"
                  @drop.prevent="handleDrop"
                >
                  <span class="picker-icon" aria-hidden="true">
                    <i class="bi bi-cloud-arrow-up"></i>
                  </span>
                  <span class="picker-copy">
                    <strong>Selecciona un archivo</strong>
                    <small>o arrástralo aquí</small>
                  </span>
                </div>

                <div v-else class="selected-file">
                  <div class="selected-preview" aria-hidden="true">
                    <img v-if="previewUrl" :src="previewUrl" alt="">
                    <i v-else class="bi bi-file-earmark-text"></i>
                  </div>

                  <div class="selected-copy">
                    <strong class="text-truncate">{{ selectedFile.name }}</strong>
                    <span>{{ fileTypeLabel }} · {{ fileDetails }}</span>
                  </div>

                  <div class="selected-actions">
                    <button type="button" class="btn btn-outline-dark compact-button" :disabled="uploading" @click="openFilePicker">
                      Cambiar
                    </button>
                    <button type="button" class="remove-button" aria-label="Quitar archivo" :disabled="uploading" @click="removeFile">
                      <i class="bi bi-trash3" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>

                <p v-if="fileError" class="field-error mb-0" role="alert">{{ fileError }}</p>
              </section>

              <section class="details-panel" aria-labelledby="details-section-title">
                <h2 id="details-section-title" class="section-title">Información</h2>

                <div class="form-grid">
                  <div class="form-field form-field--full">
                    <label for="file-title" class="form-label">Título</label>
                    <input
                      id="file-title"
                      ref="titleInput"
                      v-model="form.title"
                      type="text"
                      class="form-control"
                      maxlength="160"
                      required
                      autocomplete="off"
                    >
                  </div>

                  <div class="form-field form-field--full">
                    <label for="file-description" class="form-label">Descripción</label>
                    <textarea id="file-description" v-model="form.description" class="form-control" rows="3"></textarea>
                  </div>

                  <div class="form-field">
                    <label for="file-alt" class="form-label">Texto alternativo</label>
                    <input id="file-alt" v-model="form.alt_text" type="text" class="form-control" placeholder="Opcional">
                  </div>

                  <div class="form-field">
                    <label for="file-keywords" class="form-label">Palabras clave</label>
                    <input id="file-keywords" v-model="form.keywords" type="text" class="form-control" placeholder="Separadas por comas">
                  </div>
                </div>

                <div v-if="submitError" class="submit-error" role="alert">
                  <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
                  <span>{{ submitError }}</span>
                </div>
              </section>
            </div>
          </div>

          <footer class="card-footer create-footer">
            <div class="form-check">
              <input id="file-main" v-model="form.is_main" class="form-check-input" type="checkbox">
              <label class="form-check-label" for="file-main">Archivo principal</label>
            </div>

            <div class="footer-actions">
              <router-link to="/files" class="btn btn-outline-dark compact-button">Cancelar</router-link>
              <button type="submit" class="btn btn-dark compact-button" :disabled="uploading">
                <span v-if="uploading" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                {{ uploading ? 'Subiendo…' : 'Subir archivo' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </main>
</template>

<style scoped>
.files-create-page {
  color: #212529;
}

.create-shell {
  width: min(100%, 980px);
}

.create-header {
  display: flex;
  min-height: 2.5rem;
  margin-bottom: 0.875rem;
  align-items: center;
}

.back-button,
.remove-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #59636d;
  background: transparent;
  border: 0;
  border-radius: 0.4rem;
}

.back-button {
  width: 2rem;
  height: 2rem;
  text-decoration: none;
}

.back-button:hover,
.remove-button:hover {
  color: #212529;
  background: #eceff1;
}

.create-card {
  overflow: hidden;
  border-radius: 0.75rem;
}

.create-card-body {
  padding: 0;
}

.form-layout {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
}

.upload-panel,
.details-panel {
  padding: 1.5rem;
}

.upload-panel {
  background: #fafbfc;
  border-right: 1px solid #edf0f2;
}

.details-panel {
  min-width: 0;
}

.section-title {
  margin: 0 0 0.75rem;
  color: #6c757d;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}

.file-picker,
.selected-file {
  display: flex;
  min-height: 15.5rem;
  padding: 1.25rem;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 0.875rem;
  background: #fff;
  border: 1px dashed #c8cdd2;
  border-radius: 0.625rem;
}

.file-picker {
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.file-picker:hover,
.file-picker:focus-visible,
.file-picker.is-dragging {
  background: #f7f8f9;
  border-color: #495057;
  outline: 0;
}

.picker-icon {
  display: inline-flex;
  width: 3rem;
  height: 3rem;
  align-items: center;
  justify-content: center;
  color: #495057;
  background: #f1f3f5;
  border-radius: 0.5rem;
  font-size: 1.3rem;
}

.picker-copy strong,
.picker-copy small {
  display: block;
  text-align: center;
}

.picker-copy strong,
.selected-copy strong {
  color: #212529;
  font-size: 0.875rem;
  font-weight: 600;
}

.picker-copy small,
.selected-copy span {
  margin-top: 0.2rem;
  color: #7a828a;
  font-size: 0.75rem;
}

.selected-file {
  padding: 0.75rem;
  border-style: solid;
  justify-content: flex-start;
}

.selected-preview {
  display: flex;
  width: 100%;
  height: 10rem;
  flex: 0 0 10rem;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: #7a828a;
  background: #f1f3f5;
  border-radius: 0.5rem;
  font-size: 2.25rem;
}

.selected-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.selected-copy {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
}

.selected-actions,
.footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.selected-actions {
  width: 100%;
  margin-top: auto;
}

.selected-actions .compact-button {
  flex: 1;
}

.remove-button {
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 2.5rem;
  border: 1px solid #dfe3e6;
}

.field-error {
  margin-top: 0.5rem;
  color: #b42318;
  font-size: 0.78rem;
}

.form-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-field--full {
  grid-column: 1 / -1;
}

.form-label {
  margin-bottom: 0.4rem;
  color: #343a40;
  font-size: 0.8rem;
  font-weight: 600;
}

.form-control {
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  background: #fff;
  border-color: #dfe3e6;
  font-size: 0.875rem;
}

textarea.form-control {
  min-height: 5.75rem;
  resize: vertical;
}

.form-control:focus,
.form-check-input:focus {
  border-color: #495057;
  box-shadow: 0 0 0 0.15rem rgba(33, 37, 41, 0.1);
}

.submit-error {
  display: flex;
  margin-top: 1rem;
  padding: 0.65rem 0.75rem;
  align-items: center;
  gap: 0.5rem;
  color: #842029;
  background: #fff5f5;
  border: 1px solid #f1c2c7;
  border-radius: 0.5rem;
  font-size: 0.8rem;
}

.create-footer {
  display: flex;
  min-height: 64px;
  padding: 0.75rem 1.5rem;
  align-items: center;
  gap: 1rem;
  background: #fff;
  border-top: 1px solid #edf0f2;
}

.form-check-label {
  color: #495057;
  font-size: 0.825rem;
}

.form-check-input {
  cursor: pointer;
}

.form-check-input:checked {
  background-color: #212529;
  border-color: #212529;
}

.footer-actions {
  margin-left: auto;
}

.compact-button {
  display: inline-flex;
  min-width: 92px;
  height: 2.5rem;
  padding: 0 1rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  font-size: 0.825rem;
  font-weight: 600;
  line-height: 1;
}

.compact-button .spinner-border {
  margin-right: 0.4rem;
}

@media (max-width: 767.98px) {
  .form-layout {
    grid-template-columns: 1fr;
  }

  .upload-panel,
  .details-panel {
    padding: 1.25rem;
  }

  .upload-panel {
    border-right: 0;
    border-bottom: 1px solid #edf0f2;
  }

  .file-picker,
  .selected-file {
    min-height: auto;
  }

  .file-picker {
    min-height: 8rem;
  }

  .selected-file {
    display: grid;
    grid-template-columns: 4rem minmax(0, 1fr) auto;
    align-items: center;
  }

  .selected-preview {
    width: 4rem;
    height: 4rem;
    min-height: 0;
    flex-basis: 4rem;
  }

  .selected-actions {
    width: auto;
    margin-top: 0;
  }

  .selected-actions .compact-button {
    flex: initial;
  }
}

@media (max-width: 575.98px) {
  .upload-panel,
  .details-panel {
    padding: 1rem;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-field--full {
    grid-column: auto;
  }

  .selected-file {
    display: flex;
    align-items: center;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .selected-actions {
    width: 100%;
  }

  .selected-actions .compact-button {
    flex: 1;
  }

  .create-footer {
    padding: 1rem;
    align-items: stretch;
    flex-direction: column;
  }

  .footer-actions {
    width: 100%;
    margin-left: 0;
  }

  .footer-actions .compact-button {
    flex: 1;
  }
}
</style>
