<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '../../lib/supabase'
import { getAuthenticatedAdmin } from '../../lib/profileAccess'

const router = useRouter()
const toast = useToast()

const profiles = ref([])
const loading = ref(true)
const loadError = ref('')
const currentUserId = ref(null)

const ROLE_LABELS = {
  admin: { label: 'Admin', class: 'text-bg-dark' },
  editor: { label: 'Editor', class: 'text-bg-primary' },
  subscriber: { label: 'Suscriptor', class: 'text-bg-secondary' },
}

async function fetchProfiles() {
  loading.value = true
  loadError.value = ''

  try {
    const user = await getAuthenticatedAdmin()
    currentUserId.value = user.id

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, gender, birth_date, updated_at')
      .order('updated_at', { ascending: false })

    if (error) throw error
    profiles.value = data
  } catch (err) {
    console.error('Error fetching profiles:', err)
    profiles.value = []

    if (err.message === 'AUTH_REQUIRED') {
      await router.replace({ name: 'login' })
      return
    }

    if (err.message === 'ADMIN_REQUIRED') {
      toast.error('No tienes permisos para administrar perfiles.')
      await router.replace({ name: 'profile' })
      return
    }

    loadError.value = 'No se pudieron cargar los perfiles. Intenta nuevamente.'
    toast.error(loadError.value)
  } finally {
    loading.value = false
  }
}

function getRoleBadge(role) {
  return ROLE_LABELS[role] || { label: role || 'Sin rol', class: 'text-bg-light' }
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(fetchProfiles)
</script>

<template>
  <div class="container-fluid py-5">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
      <div>
        <h1 class="h2 fw-bold mb-1">Usuarios</h1>
        <p class="text-muted mb-0">Gestiona los perfiles y roles de los usuarios registrados</p>
      </div>
    </div>

    <div class="alert alert-light border small">
      Esta pantalla permite editar perfiles y roles. La eliminación de cuentas no está disponible aquí
      para evitar dejar cuentas activas sin perfil.
    </div>

    <!-- Tabla de Perfiles -->
    <div class="card shadow-sm border-0 overflow-hidden" style="border-radius: 0.5em;">
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-dark" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
      </div>

      <div v-else-if="loadError" class="text-center py-5 bg-white" role="alert">
        <p class="text-danger">{{ loadError }}</p>
        <button type="button" class="btn btn-outline-dark" @click="fetchProfiles">Reintentar</button>
      </div>

      <div v-else-if="profiles.length === 0" class="text-center py-5 bg-white">
        <i class="bi bi-people display-4 text-muted opacity-25"></i>
        <p class="mt-3 text-muted">No hay usuarios registrados todavía.</p>
      </div>

      <div v-else class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="bg-light">
            <tr>
              <th scope="col" class="ps-4">Nombre</th>
              <th scope="col">Rol</th>
              <th scope="col">Género</th>
              <th scope="col">Fecha nacimiento</th>
              <th scope="col">Actualizado</th>
              <th scope="col" class="pe-4 text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="profile in profiles" :key="profile.id">
              <td class="ps-4">
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

.table-hover tbody tr:hover {
  background-color: rgba(0,0,0,0.01);
}
</style>
