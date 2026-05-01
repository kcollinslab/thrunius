<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const loading = ref(false)
const user = ref(null)
const feedback = ref({ type: '', message: '' })

// Estado del formulario
const fileInput = ref(null)
const selectedFile = ref(null)
const previewUrl = ref(null)
const imageDimensions = ref({ w: 0, h: 0 })

const form = ref({
  title: '',
  description: '',
  alt_text: '',
  keywords: '',
  is_main: false,
  bucket_id: 'media' // Apunta a tu nuevo bucket
})

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    router.push('/login')
    return
  }
  user.value = session.user
})

function handleFileChange(event) {
  const file = event.target.files[0]
  if (!file) return

  selectedFile.value = file
  
  if (file.type.startsWith('image/')) {
    previewUrl.value = URL.createObjectURL(file)
    // Calcular dimensiones para la vista previa
    const img = new Image()
    img.onload = () => {
      imageDimensions.value = { w: img.width, h: img.height }
    }
    img.src = previewUrl.value
  } else {
    previewUrl.value = null
    imageDimensions.value = { w: 0, h: 0 }
  }

  // Auto-título basado en el nombre del archivo
  if (!form.value.title) {
    form.value.title = file.name.replace(/\.[^/.]+$/, "")
  }
}

// Función para comprimir y redimensionar imágenes usando Canvas
async function processImage(file, maxWidth, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Redimensionar proporcionalmente
        if (width > maxWidth) {
          height = (maxWidth * height) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob((blob) => {
          resolve(blob)
        }, 'image/jpeg', quality)
      }
    }
  })
}

async function uploadFile() {
  if (!selectedFile.value) {
    feedback.value = { type: 'danger', message: 'Por favor, selecciona un archivo.' }
    return
  }

  loading.value = true
  feedback.value = { type: '', message: '' }

  try {
    const file = selectedFile.value
    const fileExt = 'jpg' // Forzamos JPG para las versiones procesadas
    const isImage = file.type.startsWith('image/')
    
    // Rutas Base
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const uniqueId = `${Math.random().toString(36).substring(2, 10)}${Date.now()}`
    
    let mainFilePath = `uploads/${year}/${month}/${uniqueId}.${fileExt}`
    let thumbFilePath = null
    let finalFile = file

    // 1. Procesar si es imagen
    if (isImage) {
      // Imagen Optimizada (Max 1600px para la web)
      finalFile = await processImage(file, 1600, 0.8)
      
      // Miniatura (Max 300px para el listado)
      const thumbBlob = await processImage(file, 300, 0.7)
      thumbFilePath = `uploads/${year}/${month}/thumb_${uniqueId}.jpg`
      
      await supabase.storage.from(form.value.bucket_id).upload(thumbFilePath, thumbBlob)
    }

    // 2. Subir archivo principal (optimizado o original si no es imagen)
    const { error: uploadError } = await supabase.storage
      .from(form.value.bucket_id)
      .upload(mainFilePath, finalFile)

    if (uploadError) throw uploadError

    // 3. Registrar en la tabla 'files'
    const { error: dbError } = await supabase
      .from('files')
      .insert({
        bucket_id: form.value.bucket_id,
        file_name: file.name,
        extension: isImage ? 'jpg' : file.name.split('.').pop(),
        storage_path: mainFilePath,
        thumbnail_path: thumbFilePath, // Guardamos la ruta de la miniatura
        mime_type: isImage ? 'image/jpeg' : file.type,
        size_bytes: finalFile.size,
        is_image: isImage,
        width: imageDimensions.value.w,
        height: imageDimensions.value.h,
        title: form.value.title,
        description: form.value.description,
        alt_text: form.value.alt_text,
        keywords: form.value.keywords ? form.value.keywords.split(',').map(k => k.trim()) : [],
        is_main: form.value.is_main,
        creator_id: user.value.id,
        updater_id: user.value.id
      })

    if (dbError) throw dbError

    feedback.value = { type: 'success', message: '¡Archivo y miniatura procesados con éxito!' }
    setTimeout(() => router.push('/files'), 1500)

  } catch (error) {
    console.error('Error:', error)
    feedback.value = { type: 'danger', message: 'Error: ' + error.message }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container-fluid py-4">
    <div class="row justify-content-center">
      <div class="col-md-10 col-xl-8">
        <!-- Encabezado -->
        <div class="d-flex align-items-center gap-3 mb-4">
          <router-link to="/files" class="btn btn-outline-dark btn-sm rounded-circle p-2">
            <i class="bi bi-arrow-left"></i>
          </router-link>
          <div>
            <h1 class="h3 fw-bold mb-0">Subir nuevo archivo</h1>
            <p class="text-muted mb-0">La carpeta se creará automáticamente por año y mes</p>
          </div>
        </div>

        <!-- Alert -->
        <div v-if="feedback.message" class="alert alert-dismissible fade show mb-4 border-0 shadow-sm" :class="`alert-${feedback.type}`">
          <i class="bi me-2" :class="feedback.type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'"></i>
          {{ feedback.message }}
          <button type="button" class="btn-close" @click="feedback.message = ''"></button>
        </div>

        <div class="row g-4">
          <!-- Columna Principal -->
          <div class="col-lg-8">
            <div class="card border-0 shadow-sm p-4" style="border-radius: 0.75em;">
              <form @submit.prevent="uploadFile">
                <div class="mb-4 text-center">
                  <div class="upload-area border-dashed rounded p-5" @click="fileInput.click()">
                    <input type="file" ref="fileInput" class="d-none" @change="handleFileChange">
                    <div v-if="!selectedFile">
                      <i class="bi bi-cloud-arrow-up display-4 text-muted"></i>
                      <p class="mt-3 fw-bold">Haz clic o arrastra un archivo aquí</p>
                      <small class="text-muted text-uppercase">Imágenes, Video o PDF</small>
                    </div>
                    <div v-else class="d-flex align-items-center justify-content-center gap-3">
                      <i class="bi bi-file-earmark-check fs-1 text-success"></i>
                      <div class="text-start">
                        <div class="fw-bold">{{ selectedFile.name }}</div>
                        <small class="text-muted">{{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-bold small text-uppercase text-muted">Título del archivo</label>
                  <input v-model="form.title" type="text" class="form-control form-control-custom" placeholder="Ej: Paisaje de montaña">
                </div>

                <div class="mb-3">
                  <label class="form-label fw-bold small text-uppercase text-muted">Descripción</label>
                  <textarea v-model="form.description" class="form-control form-control-custom" rows="3" placeholder="Añade detalles adicionales..."></textarea>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label fw-bold small text-uppercase text-muted">Texto Alternativo (Alt Tooltip)</label>
                    <input v-model="form.alt_text" type="text" class="form-control form-control-custom" placeholder="Útil para accesibilidad">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label fw-bold small text-uppercase text-muted">Palabras Clave</label>
                    <input v-model="form.keywords" type="text" class="form-control form-control-custom" placeholder="naturaleza, azul, exterior">
                  </div>
                </div>

                <div class="d-flex justify-content-between align-items-center mt-4 pt-4 border-top">
                  <div class="form-check form-switch">
                    <input v-model="form.is_main" class="form-check-input" type="checkbox" id="isMainSwitch">
                    <label class="form-check-label fw-bold small" for="isMainSwitch">ARCHIVO PRINCIPAL</label>
                  </div>
                  <button type="submit" class="btn btn-dark px-5 py-2 rounded-pill shadow-sm" :disabled="loading">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                    {{ loading ? 'Procesando...' : 'Guardar en Biblioteca' }}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Columna Lateral -->
          <div class="col-lg-4">
            <div class="card border-0 shadow-sm overflow-hidden" style="border-radius: 0.75em;">
              <div class="card-header bg-white p-3 border-bottom">
                <h6 class="mb-0 fw-bold small text-uppercase text-muted">Panel de Inspección</h6>
              </div>
              <div class="preview-box bg-light d-flex align-items-center justify-content-center" style="aspect-ratio: 1/1;">
                <img v-if="previewUrl" :src="previewUrl" class="img-fluid object-fit-cover w-100 h-100">
                <i v-else class="bi bi-image text-muted opacity-25" style="font-size: 5rem;"></i>
              </div>
              <div class="card-body p-3 small">
                <div v-if="selectedFile">
                  <div class="d-flex justify-content-between mb-2">
                    <span class="text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Formato:</span>
                    <span class="fw-bold">{{ selectedFile.type }}</span>
                  </div>
                  <div v-if="imageDimensions.w > 0" class="d-flex justify-content-between mb-2">
                    <span class="text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Resolución:</span>
                    <span class="badge bg-dark">{{ imageDimensions.w }} x {{ imageDimensions.h }} px</span>
                  </div>
                  <div class="d-flex justify-content-between">
                    <span class="text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Destino:</span>
                    <span class="text-truncate ps-2">/media/uploads/...</span>
                  </div>
                </div>
                <div v-else class="text-center text-muted py-3">
                  Selecciona un archivo para ver sus propiedades técnicas.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-area {
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  background-color: #fafafa;
}
.upload-area:hover {
  background-color: #f0f0f0;
  border-color: #212529;
}
.border-dashed {
  border: 2px dashed #ced4da;
}
.form-control-custom {
  border-color: #eee;
  padding: 0.6rem 0.8rem;
  font-size: 0.9rem;
}
.form-control-custom:focus {
  border-color: #212529;
  box-shadow: none;
}
.object-fit-cover {
  object-fit: cover;
}
</style>
