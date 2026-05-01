<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'

const route = useRoute()
const router = useRouter()
const fileId = route.params.id

const loading = ref(true)
const saving = ref(false)
const feedback = ref({ type: '', message: '' })

const fileData = ref({
  title: '',
  description: '',
  alt_text: '',
  keywords: '',
  is_main: false
})

const fileMeta = ref(null) // Para datos técnicos no editables

onMounted(async () => {
  await fetchFileData()
})

async function fetchFileData() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*, posts(title)')
      .eq('id', fileId)
      .single()

    if (error) throw error
    
    fileMeta.value = data
    fileData.value = {
      title: data.title || '',
      description: data.description || '',
      alt_text: data.alt_text || '',
      keywords: data.keywords ? data.keywords.join(', ') : '',
      is_main: data.is_main
    }
  } catch (err) {
    console.error('Error fetching file:', err)
    feedback.value = { type: 'danger', message: 'No se pudo cargar el archivo.' }
  } finally {
    loading.value = false
  }
}

async function updateFile() {
  saving.value = true
  feedback.value = { type: '', message: '' }
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    const { error } = await supabase
      .from('files')
      .update({
        title: fileData.value.title,
        description: fileData.value.description,
        alt_text: fileData.value.alt_text,
        keywords: fileData.value.keywords ? fileData.value.keywords.split(',').map(k => k.trim()) : [],
        is_main: fileData.value.is_main,
        updater_id: session?.user?.id
      })
      .eq('id', fileId)

    if (error) throw error
    
    feedback.value = { type: 'success', message: 'Metadatos actualizados correctamente.' }
    setTimeout(() => router.push('/files'), 1500)
  } catch (err) {
    console.error('Error updating file:', err)
    feedback.value = { type: 'danger', message: 'Error al actualizar los datos.' }
  } finally {
    saving.value = false
  }
}

function getFileUrl(path) {
  if (!path) return ''
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

function formatSize(bytes) {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<template>
  <div class="container-fluid py-4">
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-dark" role="status"></div>
    </div>

    <div v-else class="row justify-content-center">
      <div class="col-md-10 col-xl-8">
        <!-- Encabezado -->
        <div class="d-flex align-items-center gap-3 mb-4">
          <router-link to="/files" class="btn btn-outline-dark btn-sm rounded-circle p-2 shadow-sm">
            <i class="bi bi-arrow-left"></i>
          </router-link>
          <div>
            <h1 class="h3 fw-bold mb-0">Editar Metadatos</h1>
            <p class="text-muted mb-0">Ajusta la información descriptiva del archivo</p>
          </div>
        </div>

        <div v-if="feedback.message" class="alert alert-dismissible fade show mb-4 border-0 shadow-sm" :class="`alert-${feedback.type}`">
          <i class="bi me-2" :class="feedback.type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'"></i>
          {{ feedback.message }}
          <button type="button" class="btn-close" @click="feedback.message = ''"></button>
        </div>

        <div class="row g-4">
          <!-- Columna Izquierda: Formulario -->
          <div class="col-lg-7">
            <div class="card border-0 shadow-sm p-4" style="border-radius: 0.75em;">
              <form @submit.prevent="updateFile">
                <div class="mb-3">
                  <label class="form-label fw-bold small text-uppercase text-muted">Título / Nombre</label>
                  <input v-model="fileData.title" type="text" class="form-control form-control-custom" placeholder="Ej: Banner principal">
                </div>

                <div class="mb-3">
                  <label class="form-label fw-bold small text-uppercase text-muted">Descripción</label>
                  <textarea v-model="fileData.description" class="form-control form-control-custom" rows="4" placeholder="Detalles sobre el uso del archivo..."></textarea>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-bold small text-uppercase text-muted">Texto Alternativo (SEO)</label>
                  <input v-model="fileData.alt_text" type="text" class="form-control form-control-custom" placeholder="Descripción para buscadores">
                </div>

                <div class="mb-4">
                  <label class="form-label fw-bold small text-uppercase text-muted">Palabras Clave (Separadas por coma)</label>
                  <input v-model="fileData.keywords" type="text" class="form-control form-control-custom" placeholder="etiqueta1, etiqueta2">
                </div>

                <div class="d-flex justify-content-between align-items-center pt-3 border-top">
                  <div class="form-check form-switch">
                    <input v-model="fileData.is_main" class="form-check-input" type="checkbox" id="mainSwitch">
                    <label class="form-check-label fw-bold small" for="mainSwitch">MARCAR COMO PRINCIPAL</label>
                  </div>
                  <button type="submit" class="btn btn-dark px-4 py-2 rounded-pill shadow-sm" :disabled="saving">
                    <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Columna Derecha: Previsualización e Info Técnica -->
          <div class="col-lg-5">
            <div class="card border-0 shadow-sm overflow-hidden" style="border-radius: 0.75em;">
              <!-- Vista previa real -->
              <div v-if="fileMeta?.is_image" class="preview-box bg-light border-bottom d-flex align-items-center justify-content-center" style="aspect-ratio: 16/9;">
                <img :src="getFileUrl(fileMeta.storage_path)" class="img-fluid object-fit-cover w-100 h-100">
              </div>
              <div v-else class="preview-box bg-light border-bottom d-flex align-items-center justify-content-center" style="aspect-ratio: 16/9;">
                <i class="bi bi-file-earmark-text text-muted opacity-25" style="font-size: 4rem;"></i>
              </div>

              <div class="card-body p-4">
                <h6 class="fw-bold small text-uppercase text-muted mb-3">Información del Archivo</h6>
                
                <div class="info-grid">
                  <div class="info-item mb-2 pb-2 border-bottom">
                    <span class="text-muted d-block small">Nombre Físico</span>
                    <span class="fw-bold text-truncate d-block">{{ fileMeta?.file_name }}</span>
                  </div>
                  <div class="row g-2 mb-2 pb-2 border-bottom">
                    <div class="col-6">
                      <span class="text-muted d-block small">Formato</span>
                      <span class="badge bg-light text-dark border">{{ fileMeta?.extension?.toUpperCase() }} / {{ fileMeta?.mime_type }}</span>
                    </div>
                    <div class="col-6">
                      <span class="text-muted d-block small">Tamaño</span>
                      <span class="fw-bold">{{ formatSize(fileMeta?.size_bytes) }}</span>
                    </div>
                  </div>
                  <div v-if="fileMeta?.width" class="info-item mb-2 pb-2 border-bottom">
                    <span class="text-muted d-block small">Dimensiones</span>
                    <span class="fw-bold">{{ fileMeta.width }} x {{ fileMeta.height }} px</span>
                  </div>
                  <div class="info-item mb-3">
                    <span class="text-muted d-block small">Vinculado a:</span>
                    <div v-if="fileMeta?.posts" class="text-primary fw-bold">
                      <i class="bi bi-journal-text me-1"></i> {{ fileMeta.posts.title }}
                    </div>
                    <div v-else class="text-muted small italic">Archivo general (Sin relación)</div>
                  </div>
                </div>

                <div class="d-grid mt-2">
                  <a :href="getFileUrl(fileMeta?.storage_path)" target="_blank" class="btn btn-sm btn-outline-secondary">
                    <i class="bi bi-box-arrow-up-right me-2"></i>Ver archivo original
                  </a>
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
.form-control-custom {
  border-color: #f0f0f0;
  background-color: #fafafa;
  transition: all 0.2s;
}

.form-control-custom:focus {
  background-color: #fff;
  border-color: #212529;
  box-shadow: none;
}

.preview-box {
  background-image: 
    linear-gradient(45deg, #f8f9fa 25%, transparent 25%), 
    linear-gradient(-45deg, #f8f9fa 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #f8f9fa 75%), 
    linear-gradient(-45deg, transparent 75%, #f8f9fa 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

.object-fit-cover {
  object-fit: contain;
}

.info-item .fw-bold {
  font-size: 0.9rem;
}

.badge {
  font-size: 0.65rem;
}
</style>
