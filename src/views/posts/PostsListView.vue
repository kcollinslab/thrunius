<script setup>
import { ref, onMounted, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '../../lib/supabase'
import ModalDelete from '../../components/ModalDelete.vue'

const toast = useToast()
const posts = ref([])
const loading = ref(true)
const feedback = ref({ type: '', message: '' })
const selectedIds = ref([])
const showDeleteModal = ref(false)

async function fetchPosts() {
  loading.value = true
  // Al recargar no borramos el feedback por si acaba de ocurrir un éxito
  selectedIds.value = []
  
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    posts.value = data
  } catch (err) {
    console.error('Error fetching posts:', err)
    feedback.value = { type: 'danger', message: 'No se pudieron cargar las noticias. Revisa tu conexión.' }
  } finally {
    loading.value = false
  }
}

function openDeleteModal() {
  if (selectedIds.value.length > 0) {
    showDeleteModal.value = true
  }
}

async function confirmDeleteSelected() {
  const countToDelete = selectedIds.value.length
  showDeleteModal.value = false
  loading.value = true
  feedback.value = { type: '', message: '' }
  
  try {
    const { error } = await supabase
      .from('posts')
      .delete()
      .in('id', selectedIds.value)

    if (error) throw error
    
    toast.success(`${countToDelete === 1 ? 'Publicación eliminada' : 'Publicaciones eliminadas'} correctamente.`)
    await fetchPosts()
  } catch (err) {
    console.error('Error deleting posts:', err)
    feedback.value = { type: 'danger', message: 'Ocurrió un error al intentar eliminar las publicaciones.' }
    loading.value = false
  }
}

const toggleSelectAll = (event) => {
  if (event.target.checked) {
    selectedIds.value = posts.value.map(p => p.id)
  } else {
    selectedIds.value = []
  }
}

const isAllSelected = computed(() => {
  return posts.value.length > 0 && selectedIds.value.length === posts.value.length
})

const getVisibilityBadgeClass = (visibility) => {
  switch (visibility) {
    case 'Público': return 'text-bg-success'
    case 'Privado': return 'text-bg-warning'
    case 'Oculto': return 'text-bg-secondary'
    default: return 'text-bg-light'
  }
}

onMounted(() => {
  fetchPosts()
})
</script>

<template>
  <div class="container-fluid py-2">
    <div class="row mb-3">
      <div class="col-6">
        <input
          type="text"
          class="form-control form-control-sm"
          placeholder="Buscar por título o resumen..."
          v-model="feedback.message"
          @input="feedback.message = ''"
          aria-label="Buscar publicaciones por título o resumen"
        >
      </div>
      <div class="col-6">
        <div>
          <router-link to="/posts/new" class="btn btn-dark d-flex align-items-center gap-2">
            <i class="bi bi-plus-lg"></i>
            <span>Nueva Publicación</span>
          </router-link>
        </div>
        <button 
          v-if="selectedIds.length > 0"
          @click="openDeleteModal"
          class="btn btn-danger delete-selected-btn d-flex align-items-center justify-content-center"
          :aria-label="`Eliminar ${selectedIds.length} ${selectedIds.length === 1 ? 'publicación' : 'publicaciones'}`"
          :title="`Eliminar ${selectedIds.length} ${selectedIds.length === 1 ? 'publicación' : 'publicaciones'}`"
        >
          <i class="bi bi-trash-fill"></i>
        </button>
      </div>
    </div>

    <!-- Mensajes de Feedback -->
    <div v-if="feedback.message" class="alert alert-dismissible fade show d-flex align-items-center" :class="`alert-${feedback.type}`" role="alert">
      <i v-if="feedback.type === 'danger'" class="bi bi-exclamation-triangle-fill me-2"></i>
      <i v-else class="bi bi-check-circle-fill me-2"></i>
      <div>{{ feedback.message }}</div>
      <button type="button" class="btn-close" @click="feedback.message = ''" aria-label="Close"></button>
    </div>

    <!-- Tabla de Posts -->
    <div class="card shadow-sm border-0 overflow-hidden" style="border-radius: 0.5em;">
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-dark" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
      </div>

      <div v-else-if="posts.length === 0" class="text-center py-5 bg-white">
        <i class="bi bi-journal-x display-4 text-muted opacity-25"></i>
        <p class="mt-3 text-muted">No hay publicaciones disponibles todavía.</p>
      </div>

      <div v-else class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="bg-light">
            <tr>
              <th scope="col" class="ps-4" style="width: 40px;">
                <input 
                  type="checkbox" 
                  class="form-check-input" 
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                >
              </th>
              <th scope="col">Título</th>
              <th scope="col">Visibilidad</th>
              <th scope="col">Tipo</th>
              <th scope="col">Resumen</th>
              <th scope="col">Fecha</th>
              <th scope="col" class="pe-4 text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="post in posts" :key="post.id" :class="{'table-active': selectedIds.includes(post.id)}">
              <td class="ps-4">
                <input 
                  type="checkbox" 
                  class="form-check-input" 
                  v-model="selectedIds" 
                  :value="post.id"
                >
              </td>
              <td>
                <router-link
                  :to="`/posts/edit/${post.id}`"
                  class="fw-bold text-dark text-decoration-none post-title-link"
                >
                  {{ post.title }}
                </router-link>
                <small class="text-muted d-block text-truncate" style="max-width: 200px;">{{ post.subtitle }}</small>
              </td>
              <td>
                <span class="badge text-uppercase" :class="getVisibilityBadgeClass(post.visibility)">
                  {{ post.visibility }}
                </span>
              </td>
              <td>
                <span class="badge bg-light text-dark border">
                  {{ post.type_post }}
                </span>
              </td>
              <td>
                <p class="mb-0 text-muted small text-truncate-2" style="max-width: 250px;">
                  {{ post.excerpt || 'Sin resumen...' }}
                </p>
              </td>
              <td>
                <small class="text-muted">
                  {{ new Date(post.created_at).toLocaleDateString() }}
                </small>
              </td>
              <td class="pe-4 text-end">
                <div class="btn-group">
                  <router-link :to="`/posts/edit/${post.id}`" class="btn btn-sm btn-outline-dark border-0" title="Editar">
                    <i class="bi bi-pencil"></i>
                  </router-link>
                  <router-link :to="`/posts/preview/${post.id}`" class="btn btn-sm btn-outline-dark border-0" title="Ver vista previa">
                    <i class="bi bi-eye"></i>
                  </router-link>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Modal de Confirmación -->
  <ModalDelete 
    :show="showDeleteModal" 
    :count="selectedIds.length"
    title="Eliminar Publicaciones"
    @confirm="confirmDeleteSelected"
    @close="showDeleteModal = false"
  />
</template>

<style scoped>
.table-responsive {
  min-height: 300px;
}

.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.badge {
  font-weight: 600;
  font-size: 0.7rem;
  letter-spacing: 0.03em;
}

.table thead th {
  font-size: 0.85rem;
  text-transform: uppercase;
  color: #6c757d;
  letter-spacing: 0.05em;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.form-check-input {
  cursor: pointer;
}

/* Efectos de hover en filas */
.table-hover tbody tr:hover {
  background-color: rgba(0,0,0,0.01);
}

.post-title-link:hover {
  text-decoration: underline !important;
}

.delete-selected-btn {
  height: 38px;
  width: 38px;
  padding: 0;
}
</style>
