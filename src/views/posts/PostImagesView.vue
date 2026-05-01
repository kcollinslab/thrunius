<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '../../lib/supabase'
import ModalDelete from '../../components/ModalDelete.vue'

const route = useRoute()
const toast = useToast()
const post = ref(null)
const files = ref([])
const loading = ref(true)
const uploading = ref(false)
const feedback = ref({ type: '', message: '' })
const fileInput = ref(null)
const showDeleteModal = ref(false)
const fileToDelete = ref(null)

const postId = route.params.id

const imageCount = computed(() => files.value.length)
const totalSize = computed(() => files.value.reduce((sum, file) => sum + (file.size_bytes || 0), 0))
const galleryTitle = computed(() => post.value?.title?.trim() || '(Sin nombre)')
const uploadButtonLabel = computed(() => uploading.value ? 'Procesando...' : 'Seleccionar imagenes')

onMounted(async () => {
  await Promise.all([
    fetchPost(),
    fetchFiles(),
  ])
  loading.value = false
})

async function fetchPost() {
  const { data, error } = await supabase
    .from('posts')
    .select('title')
    .eq('id', postId)
    .single()

  if (error) {
    console.error('Error fetching post:', error)
    return
  }

  post.value = data
}

async function fetchFiles() {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching files:', error)
    feedback.value = { type: 'danger', message: 'No se pudieron cargar las imagenes.' }
    return
  }

  files.value = data || []
}

function openFilePicker() {
  if (!uploading.value) {
    fileInput.value?.click()
  }
}

async function handleFileUpload(event) {
  const selectedFiles = Array.from(event.target.files || [])
  if (selectedFiles.length === 0) return

  uploading.value = true
  feedback.value = { type: '', message: '' }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No hay sesion activa.')

    for (const file of selectedFiles) {
      await processAndUpload(file, session.user.id)
    }

    toast.success(`${selectedFiles.length === 1 ? 'Imagen subida' : 'Imagenes subidas'} correctamente.`)
    await fetchFiles()
  } catch (err) {
    console.error('Error uploading:', err)
    feedback.value = { type: 'danger', message: `Error al subir: ${err.message}` }
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}

async function processAndUpload(file, userId) {
  const isImage = file.type.startsWith('image/')
  const fileExt = isImage ? 'jpg' : file.name.split('.').pop()
  const uniqueId = `${Math.random().toString(36).substring(2, 10)}${Date.now()}`

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const baseFolder = `uploads/${year}/${month}/posts/${postId}`

  const mainPath = `${baseFolder}/${uniqueId}.${fileExt}`
  let thumbPath = null
  let finalFile = file
  let width = 0
  let height = 0

  if (isImage) {
    const imgObj = await getImageDimensions(file)
    width = imgObj.w
    height = imgObj.h

    finalFile = await compressImage(file, 1600, 0.8)

    const thumbBlob = await compressImage(file, 300, 0.7)
    thumbPath = `${baseFolder}/thumb_${uniqueId}.jpg`

    const { error: thumbErr } = await supabase.storage.from('media').upload(thumbPath, thumbBlob)
    if (thumbErr) throw thumbErr
  }

  const { error: uploadErr } = await supabase.storage.from('media').upload(mainPath, finalFile)
  if (uploadErr) throw uploadErr

  const { error: dbErr } = await supabase.from('files').insert({
    post_id: postId,
    bucket_id: 'media',
    file_name: file.name,
    extension: isImage ? 'jpg' : fileExt,
    storage_path: mainPath,
    thumbnail_path: thumbPath,
    mime_type: isImage ? 'image/jpeg' : file.type,
    size_bytes: finalFile.size,
    is_image: isImage,
    width,
    height,
    creator_id: userId,
    updater_id: userId,
  })

  if (dbErr) throw dbErr
}

function getImageUrl(path) {
  if (!path) return ''
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

function formatSize(bytes) {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDimensions(file) {
  if (!file.width || !file.height) return 'Sin dimensiones'
  return `${file.width} x ${file.height}px`
}

async function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ w: img.width, h: img.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudieron leer las dimensiones de la imagen.'))
    }
    img.src = objectUrl
  })
}

async function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (maxWidth * height) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error('No se pudo comprimir la imagen.'))
            return
          }
          resolve(blob)
        }, 'image/jpeg', quality)
      }
    }
  })
}

function confirmDelete(file) {
  fileToDelete.value = file
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!fileToDelete.value) return

  const file = fileToDelete.value
  showDeleteModal.value = false
  loading.value = true
  feedback.value = { type: '', message: '' }

  try {
    const paths = [file.storage_path]
    if (file.thumbnail_path) paths.push(file.thumbnail_path)

    const { error: storageError } = await supabase.storage.from('media').remove(paths)
    if (storageError) throw storageError

    const { error: dbError } = await supabase.from('files').delete().eq('id', file.id)
    if (dbError) throw dbError

    toast.success('Imagen eliminada correctamente.')
    await fetchFiles()
  } catch (err) {
    console.error('Error deleting image:', err)
    feedback.value = { type: 'danger', message: 'Error al borrar la imagen.' }
  } finally {
    loading.value = false
    fileToDelete.value = null
  }
}
</script>

<template>
  <div class="container-fluid py-3 post-images-view">
    <div class="row justify-content-center">
      <div class="col-12 col-xxl-10">
        <div v-if="loading && !files.length" class="text-center py-5">
          <div class="spinner-border text-dark" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p class="text-muted small mt-3 mb-0">Cargando imagenes...</p>
        </div>

        <div v-else>
          <div class="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-3">
            <div>
              <p class="section-kicker mb-1">Galeria del post</p>
              <h2 class="h4 fw-bold mb-1">{{ galleryTitle }}</h2>
              <p class="text-muted mb-0">Administra las imagenes asociadas a esta publicacion.</p>
            </div>

            <div class="d-flex flex-wrap gap-2">
              <div class="metric-box border rounded bg-white">
                <span class="metric-value">{{ imageCount }}</span>
                <span class="metric-label">imagenes</span>
              </div>
              <div class="metric-box border rounded bg-white">
                <span class="metric-value">{{ formatSize(totalSize) }}</span>
                <span class="metric-label">total</span>
              </div>
            </div>
          </div>

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
            <button type="button" class="btn-close" @click="feedback.message = ''"></button>
          </div>

          <div class="card border-0 shadow-sm gallery-card mb-4">
            <div class="card-body p-3 p-lg-4">
              <button
                type="button"
                class="upload-area w-100 text-start border-dashed"
                :disabled="uploading"
                @click="openFilePicker"
              >
                <input
                  ref="fileInput"
                  type="file"
                  class="d-none"
                  multiple
                  accept="image/*"
                  @change="handleFileUpload"
                >

                <span class="upload-icon">
                  <span v-if="uploading" class="spinner-border spinner-border-sm" role="status"></span>
                  <i v-else class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
                </span>
                <span class="upload-copy">
                  <span class="fw-bold d-block">{{ uploadButtonLabel }}</span>
                  <span class="text-muted small">JPG, PNG o WebP. Se crea una version optimizada y una miniatura.</span>
                </span>
              </button>
            </div>
          </div>

          <div v-if="files.length === 0" class="empty-state bg-white border rounded text-center py-5 px-3">
            <i class="bi bi-images display-5 text-muted opacity-25"></i>
            <h3 class="h6 fw-bold mt-3 mb-1">No hay imagenes asociadas</h3>
            <p class="text-muted mb-0">Sube la primera imagen para completar la galeria del post.</p>
          </div>

          <div v-else class="row g-3">
            <div v-for="file in files" :key="file.id" class="col-12 col-sm-6 col-lg-4 col-xxl-3">
              <article class="image-card border bg-white h-100">
                <a
                  :href="getImageUrl(file.storage_path)"
                  target="_blank"
                  class="image-preview d-block ratio ratio-4x3 bg-light"
                  :title="`Ver ${file.file_name}`"
                >
                  <img
                    :src="getImageUrl(file.thumbnail_path || file.storage_path)"
                    class="object-fit-cover"
                    :alt="file.title || file.file_name"
                  >
                </a>

                <div class="p-3">
                  <h3 class="image-name fw-bold mb-1 text-truncate" :title="file.file_name">
                    {{ file.file_name }}
                  </h3>
                  <div class="d-flex flex-wrap gap-2 mb-3">
                    <span class="badge text-bg-light border">{{ formatSize(file.size_bytes) }}</span>
                    <span class="badge text-bg-light border">{{ formatDimensions(file) }}</span>
                  </div>

                  <div class="d-flex gap-2">
                    <a
                      :href="getImageUrl(file.storage_path)"
                      target="_blank"
                      class="btn btn-sm btn-light border flex-fill"
                      title="Ver original"
                    >
                      <i class="bi bi-eye me-1" aria-hidden="true"></i>
                      Ver
                    </a>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-danger delete-image-btn"
                      title="Eliminar imagen"
                      aria-label="Eliminar imagen"
                      @click="confirmDelete(file)"
                    >
                      <i class="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <ModalDelete
    :show="showDeleteModal"
    :count="1"
    title="Eliminar Imagen"
    @confirm="handleDelete"
    @close="showDeleteModal = false"
  />
</template>

<style scoped>
.gallery-card,
.image-card,
.empty-state {
  border-radius: 0.5em;
}

.section-kicker {
  color: #6c757d;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.metric-box {
  min-width: 112px;
  padding: 0.55rem 0.75rem;
}

.metric-value {
  color: #111827;
  display: block;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.1;
}

.metric-label {
  color: #6c757d;
  display: block;
  font-size: 0.75rem;
  line-height: 1.1;
}

.upload-area {
  align-items: center;
  background: #fcfcfc;
  border-radius: 0.5em;
  color: #111827;
  cursor: pointer;
  display: flex;
  gap: 1rem;
  padding: 1rem;
  transition: background-color 0.2s, border-color 0.2s;
}

.upload-area:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #212529;
}

.upload-area:disabled {
  cursor: wait;
  opacity: 0.75;
}

.upload-icon {
  align-items: center;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 0.5em;
  display: inline-flex;
  flex-shrink: 0;
  height: 44px;
  justify-content: center;
  width: 44px;
}

.border-dashed {
  border: 2px dashed #ced4da;
}

.image-card {
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
}

.image-card:hover {
  box-shadow: 0 0.5rem 1rem rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}

.image-preview {
  color: inherit;
  overflow: hidden;
  text-decoration: none;
}

.image-name {
  color: #111827;
  font-size: 0.95rem;
}

.delete-image-btn {
  align-items: center;
  display: inline-flex;
  height: 31px;
  justify-content: center;
  padding: 0;
  width: 31px;
}

.object-fit-cover {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

@media (max-width: 575.98px) {
  .metric-box {
    flex: 1 1 0;
  }

  .upload-area {
    align-items: flex-start;
  }
}
</style>
