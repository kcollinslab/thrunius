<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabase'
import ModalDelete from '../../components/ModalDelete.vue'

const profiles = ref([])
const loading = ref(true)
const feedback = ref({ type: '', message: '' })
const selectedIds = ref([])
const showDeleteModal = ref(false)
const currentUserId = ref(null)

const ROLE_LABELS = {
  admin: { label: 'Admin', class: 'text-bg-dark' },
  editor: { label: 'Editor', class: 'text-bg-primary' },
  subscriber: { label: 'Suscriptor', class: 'text-bg-secondary' },
}

async function fetchProfiles() {
  loading.value = true
  selectedIds.value = []

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) throw error
    profiles.value = data
  } catch (err) {
    console.error('Error fetching profiles:', err)
    feedback.value = { type: 'danger', message: 'No se pudieron cargar los usuarios. Revisa tu conexión.' }
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
      .from('profiles')
      .delete()
      .in('id', selectedIds.value)

    if (error) throw error

    feedback.value = {
      type: 'success',
      message: `Se han eliminado ${countToDelete} ${countToDelete === 1 ? 'usuario' : 'usuarios'} correctamente.`
    }
    await fetchProfiles()
  } catch (err) {
    console.error('Error deleting profiles:', err)
    feedback.value = { type: 'danger', message: 'Ocurrió un error al intentar eliminar los usuarios.' }
    loading.value = false
  }
}

const toggleSelectAll = (event) => {
  if (event.target.checked) {
    selectedIds.value = profiles.value
      .filter(p => p.id !== currentUserId.value)
      .map(p => p.id)
  } else {
    selectedIds.value = []
  }
}

const isAllSelected = computed(() =>
  profiles.value.length > 0 && selectedIds.value.length === profiles.value.length
)

function getRoleBadge(role) {
  return ROLE_LABELS[role] || { label: role || 'Sin rol', class: 'text-bg-light' }
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    currentUserId.value = session.user.id
  }
  fetchProfiles()
})
</script>

<template>
  <div class="container-fluid py-5">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
      <div>
        <h1 class="h2 fw-bold mb-1">Usuarios</h1>
        <p class="text-muted mb-0">Gestiona los perfiles y roles de los usuarios registrados</p>
      </div>
      <div class="d-flex gap-2">
        <button
          v-if="selectedIds.length > 0"
          @click="openDeleteModal"
          class="btn btn-outline-danger d-flex align-items-center gap-2"
        >
          <i class="bi bi-trash"></i>
          <span>Eliminar ({{ selectedIds.length }})</span>
        </button>
      </div>
    </div>

    <!-- Mensajes de Feedback -->
    <div v-if="feedback.message" class="alert alert-dismissible fade show d-flex align-items-center" :class="`alert-${feedback.type}`" role="alert">
      <i v-if="feedback.type === 'danger'" class="bi bi-exclamation-triangle-fill me-2"></i>
      <i v-else class="bi bi-check-circle-fill me-2"></i>
      <div>{{ feedback.message }}</div>
      <button type="button" class="btn-close" @click="feedback.message = ''" aria-label="Cerrar"></button>
    </div>

    <!-- Tabla de Perfiles -->
    <div class="card shadow-sm border-0 overflow-hidden" style="border-radius: 0.5em;">
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-dark" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
      </div>

      <div v-else-if="profiles.length === 0" class="text-center py-5 bg-white">
        <i class="bi bi-people display-4 text-muted opacity-25"></i>
        <p class="mt-3 text-muted">No hay usuarios registrados todavía.</p>
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
              <th scope="col">Nombre</th>
              <th scope="col">Rol</th>
              <th scope="col">Género</th>
              <th scope="col">Fecha nacimiento</th>
              <th scope="col">Actualizado</th>
              <th scope="col" class="pe-4 text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="profile in profiles" :key="profile.id" :class="{'table-active': selectedIds.includes(profile.id)}">
              <td class="ps-4">
                <input
                  type="checkbox"
                  class="form-check-input"
                  v-model="selectedIds"
                  :value="profile.id"
                  :disabled="profile.id === currentUserId"
                >
              </td>
              <td>
                <div class="fw-bold text-dark">{{ profile.full_name || '—' }}</div>
                <small class="text-muted d-block text-truncate" style="max-width: 200px;">{{ profile.id }}</small>
              </td>
              <td>
                <span class="badge text-uppercase" :class="getRoleBadge(profile.role).class">
                  {{ getRoleBadge(profile.role).label }}
                </span>
                <span v-if="profile.id === currentUserId" class="badge text-bg-info ms-2">
                  TÚ
                </span>
              </td>
              <td>
                <span class="text-muted small">{{ profile.gender || '—' }}</span>
              </td>
              <td>
                <small class="text-muted">{{ formatDate(profile.birth_date) }}</small>
              </td>
              <td>
                <small class="text-muted">{{ formatDate(profile.updated_at) }}</small>
              </td>
              <td class="pe-4 text-end">
                <div class="btn-group">
                  <router-link :to="`/profiles/edit/${profile.id}`" class="btn btn-sm btn-outline-dark border-0" title="Editar">
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

  <!-- Modal de Confirmación -->
  <ModalDelete
    :show="showDeleteModal"
    :count="selectedIds.length"
    title="Eliminar Usuarios"
    @confirm="confirmDeleteSelected"
    @close="showDeleteModal = false"
  />
</template>

<style scoped>
.table-responsive {
  min-height: 300px;
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

.table-hover tbody tr:hover {
  background-color: rgba(0,0,0,0.01);
}
</style>
