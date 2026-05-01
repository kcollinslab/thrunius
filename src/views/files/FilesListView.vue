<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabase'
import ModalDelete from '../../components/ModalDelete.vue'

const files = ref([])
const loading = ref(true)
const currentUser = ref(null)
const feedback = ref({ type: '', message: '' })
const selectedIds = ref([])
const showDeleteModal = ref(false)

// Roles autorizados para acciones de escritura/borrado
const canManageFiles = computed(() => 
  currentUser.value?.role === 'admin' || currentUser.value?.role === 'editor'
)

async function fetchUser() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    
    currentUser.value = { ...session.user, ...profile }
  }
}

async function fetchFiles() {
  loading.value = true
  selectedIds.value = []
  
  try {
    // Traemos los archivos y hacemos join con posts para mostrar a qué pertenecen
    const { data, error } = await supabase
      .from('files')
      .select(`
        *,
        posts (id, title)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    files.value = data
  } catch (err) {
    console.error('Error fetching files:', err)
    feedback.value = { type: 'danger', message: 'No se pudieron cargar los archivos.' }
  } finally {
    loading.value = false
  }
}

function getFileUrl(storagePath, bucketId = 'media') {
  if (!storagePath) return ''
  const { data } = supabase.storage.from(bucketId).getPublicUrl(storagePath)
  return data.publicUrl
}

function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function openDeleteModal() {
  if (selectedIds.value.length > 0) {
    showDeleteModal.value = true
  }
}

async function confirmDeleteSelected() {
  if (!canManageFiles.value) return

  const countToDelete = selectedIds.value.length
  const filesToDelete = files.value.filter(f => selectedIds.value.includes(f.id))
  
  showDeleteModal.value = false
  loading.value = true
  feedback.value = { type: '', message: '' }
  
  try {
    // 1. Borrar archivos físicos del Storage
    for (const file of filesToDelete) {
      const pathsToDelete = [file.storage_path]
      if (file.thumbnail_path) pathsToDelete.push(file.thumbnail_path)
      
      await supabase.storage.from(file.bucket_id).remove(pathsToDelete)
    }

    // 2. Borrar registros de la base de datos
    const { error } = await supabase
      .from('files')
      .delete()
      .in('id', selectedIds.value)

    if (error) throw error
    
    feedback.value = { 
      type: 'success', 
      message: `Se han eliminado ${countToDelete} ${countToDelete === 1 ? 'archivo' : 'archivos'} correctamente.` 
    }
    await fetchFiles()
  } catch (err) {
    console.error('Error deleting files:', err)
    feedback.value = { type: 'danger', message: 'Error al eliminar los archivos.' }
    loading.value = false
  }
}

const toggleSelectAll = (event) => {
  if (event.target.checked) {
    selectedIds.value = files.value.map(f => f.id)
  } else {
    selectedIds.value = []
  }
}

const isAllSelected = computed(() => {
  return files.value.length > 0 && selectedIds.value.length === files.value.length
})

onMounted(async () => {
  await fetchUser()
  fetchFiles()
})
</script>

<template>
  <div class="container-fluid py-5">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
      <div>
        <h1 class="h2 fw-bold mb-1">Biblioteca de Medios</h1>
        <p class="text-muted mb-0">Gestiona las imágenes y documentos del sistema</p>
      </div>
      <div v-if="canManageFiles" class="d-flex gap-2">
        <button 
          v-if="selectedIds.length > 0"
          @click="openDeleteModal"
          class="btn btn-outline-danger d-flex align-items-center gap-2"
        >
          <i class="bi bi-trash"></i>
          <span>Eliminar ({{ selectedIds.length }})</span>
        </button>
        <router-link to="/files/new" class="btn btn-dark d-flex align-items-center gap-2">
          <i class="bi bi-plus-lg"></i>
          <span>Subir Archivo</span>
        </router-link>
      </div>
    </div>

    <!-- Feedback -->
    <div v-if="feedback.message" class="alert alert-dismissible fade show d-flex align-items-center" :class="`alert-${feedback.type}`" role="alert">
      <i class="bi me-2" :class="feedback.type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'"></i>
      <div>{{ feedback.message }}</div>
      <button type="button" class="btn-close" @click="feedback.message = ''"></button>
    </div>

    <div class="card shadow-sm border-0 overflow-hidden" style="border-radius: 0.5em;">
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-dark" role="status"></div>
      </div>

      <div v-else-if="files.length === 0" class="text-center py-5 bg-white">
        <i class="bi bi-images display-4 text-muted opacity-25"></i>
        <p class="mt-3 text-muted">No hay archivos en la biblioteca.</p>
      </div>

      <div v-else class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="bg-light">
            <tr>
              <th v-if="canManageFiles" scope="col" class="ps-4" style="width: 40px;">
                <input type="checkbox" class="form-check-input" :checked="isAllSelected" @change="toggleSelectAll">
              </th>
              <th scope="col" style="width: 80px;"></th>
              <th scope="col">Nombre / Título</th>
              <th scope="col">Relacionado con</th>
              <th scope="col">Tamaño</th>
              <th scope="col">Fecha</th>
              <th scope="col" class="pe-4 text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in files" :key="file.id" :class="{'table-active': selectedIds.includes(file.id)}">
              <td v-if="canManageFiles" class="ps-4">
                <input type="checkbox" class="form-check-input" v-model="selectedIds" :value="file.id">
              </td>
              <td>
                <div v-if="file.is_image" class="ratio ratio-1x1 bg-light rounded overflow-hidden shadow-sm" style="width: 50px;">
                  <img :src="getFileUrl(file.thumbnail_path || file.storage_path, file.bucket_id)" class="object-fit-cover" :title="file.file_name">
                </div>
                <div v-else class="d-flex align-items-center justify-content-center bg-light rounded shadow-sm" style="width: 50px; height: 50px;">
                  <i class="bi bi-file-earmark-text fs-4 text-muted"></i>
                </div>
              </td>
              <td>
                <router-link v-if="canManageFiles" :to="`/files/edit/${file.id}`" class="fw-bold text-dark text-decoration-none hover-primary text-truncate d-block" style="max-width: 250px;">
                  {{ file.title || file.file_name }}
                </router-link>
                <div v-else class="fw-bold text-dark text-truncate d-block" style="max-width: 250px;">
                  {{ file.title || file.file_name }}
                </div>
                <small class="text-muted text-uppercase fw-semibold" style="font-size: 0.65rem;">{{ file.extension }} • {{ file.mime_type }}</small>
              </td>
              <td>
                <div v-if="file.posts" class="small">
                  <i class="bi bi-journal-text me-1 text-primary"></i> 
                  <router-link :to="`/posts/preview/${file.posts.id}`" class="text-decoration-none hover-primary">
                    {{ file.posts.title }}
                  </router-link>
                </div>
                <div v-else-if="file.user_id" class="small">
                  <i class="bi bi-person-circle me-1 text-success"></i> Perfil de usuario
                </div>
                <div v-else class="text-muted small italic">Sin relación</div>
              </td>
              <td>
                <small class="text-muted">{{ formatSize(file.size_bytes) }}</small>
                <div v-if="file.width" class="text-muted" style="font-size: 0.7rem;">{{ file.width }}x{{ file.height }}px</div>
              </td>
              <td>
                <small class="text-muted">{{ new Date(file.created_at).toLocaleDateString() }}</small>
              </td>
              <td class="pe-4 text-end">
                <div class="btn-group">
                  <a :href="getFileUrl(file.storage_path, file.bucket_id)" target="_blank" class="btn btn-sm btn-outline-dark border-0" title="Ver original">
                    <i class="bi bi-box-arrow-up-right"></i>
                  </a>
                  <router-link v-if="canManageFiles" :to="`/files/edit/${file.id}`" class="btn btn-sm btn-outline-dark border-0" title="Editar metadatos">
                    <i class="bi bi-pencil"></i>
                  </router-link>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <ModalDelete 
    :show="showDeleteModal" 
    :count="selectedIds.length"
    title="Eliminar Archivos"
    @confirm="confirmDeleteSelected"
    @close="showDeleteModal = false"
  />
</template>

<style scoped>
.object-fit-cover {
  object-fit: cover;
}
.table-responsive {
  min-height: 300px;
}
.badge {
  font-weight: 600;
  font-size: 0.7rem;
}
.hover-primary:hover {
  color: var(--bs-primary) !important;
}
.table thead th {
  font-size: 0.85rem;
  text-transform: uppercase;
  color: #6c757d;
  letter-spacing: 0.05em;
  padding: 1rem;
}
</style>
