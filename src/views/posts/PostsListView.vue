<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '../../lib/supabase'
import ModalDelete from '../../components/ModalDelete.vue'
import InputSearchControl from '../../components/tools/InputSearchControl.vue'
import {
  POST_VISIBILITY_KEYS,
  getPostTypeLabel,
  getPostVisibilityLabel,
  normalizePostVisibility,
} from '../../constants/catalogs'

const toast = useToast()

const posts = ref([])
const searchQuery = ref('')
const loading = ref(true)
const loadError = ref('')
const currentRole = ref('')
const selectedIds = ref([])
const showDeleteModal = ref(false)
const deleteLoading = ref(false)
const currentPage = ref(1)

const PAGE_SIZE = 20

const canDelete = computed(() => currentRole.value === 'admin')

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const filteredPosts = computed(() => {
  const query = normalizeText(searchQuery.value.trim())
  if (!query) return posts.value

  return posts.value.filter((post) => [post.title, post.subtitle, post.excerpt, getPostTypeLabel(post.type_post)]
    .some((value) => normalizeText(value).includes(query)))
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredPosts.value.length / PAGE_SIZE)))
const pageStart = computed(() => (currentPage.value - 1) * PAGE_SIZE)
const pageEnd = computed(() => Math.min(pageStart.value + PAGE_SIZE, filteredPosts.value.length))
const paginatedPosts = computed(() => filteredPosts.value.slice(pageStart.value, pageEnd.value))
const visibleIds = computed(() => paginatedPosts.value.map((post) => post.id))
const isAllSelected = computed(() => (
  canDelete.value
  && visibleIds.value.length > 0
  && visibleIds.value.every((id) => selectedIds.value.includes(id))
))

async function fetchCurrentRole() {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (error) throw error
    currentRole.value = String(data?.role || '').trim().toLowerCase()
  } catch (error) {
    console.error('Error al validar permisos de publicaciones:', error)
    currentRole.value = ''
  }
}

async function fetchPosts() {
  loading.value = true
  loadError.value = ''
  selectedIds.value = []
  currentPage.value = 1

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, subtitle, excerpt, visibility, type_post, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    posts.value = data || []
  } catch (error) {
    console.error('Error al cargar publicaciones:', error)
    loadError.value = 'No se pudieron cargar las publicaciones.'
  } finally {
    loading.value = false
  }
}

async function assertAdminPermission() {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('AUTH_REQUIRED')

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (error || String(data?.role || '').trim().toLowerCase() !== 'admin') {
    throw new Error('ADMIN_REQUIRED')
  }
}

function toggleSelectAll(event) {
  if (!canDelete.value) return

  if (event.target.checked) {
    selectedIds.value = [...new Set([...selectedIds.value, ...visibleIds.value])]
    return
  }

  selectedIds.value = selectedIds.value.filter((id) => !visibleIds.value.includes(id))
}

function openDeleteModal() {
  if (canDelete.value && selectedIds.value.length > 0) showDeleteModal.value = true
}

async function confirmDeleteSelected() {
  if (deleteLoading.value || selectedIds.value.length === 0) return

  const idsToDelete = [...selectedIds.value]
  deleteLoading.value = true
  showDeleteModal.value = false

  try {
    await assertAdminPermission()

    const { data, error } = await supabase
      .from('posts')
      .delete()
      .in('id', idsToDelete)
      .select('id')

    if (error) throw error
    if ((data?.length || 0) !== idsToDelete.length) throw new Error('DELETE_INCOMPLETE')

    toast.success(idsToDelete.length === 1
      ? 'Publicación eliminada correctamente.'
      : `${idsToDelete.length} publicaciones eliminadas correctamente.`)
    await fetchPosts()
  } catch (error) {
    console.error('Error al eliminar publicaciones:', error)

    const message = error.message === 'ADMIN_REQUIRED'
      ? 'Solo los administradores pueden eliminar publicaciones.'
      : error.message === 'AUTH_REQUIRED'
        ? 'Tu sesión expiró. Inicia sesión nuevamente.'
        : 'No se pudieron eliminar las publicaciones.'
    toast.error(message)
    await fetchCurrentRole()
  } finally {
    deleteLoading.value = false
  }
}

function clearSearch() {
  searchQuery.value = ''
}

function goToPreviousPage() {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
  selectedIds.value = []
}

function goToNextPage() {
  if (currentPage.value >= totalPages.value) return
  currentPage.value += 1
  selectedIds.value = []
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function visibilityClass(visibility) {
  const value = normalizePostVisibility(visibility)
  if (value === POST_VISIBILITY_KEYS.PUBLIC) return 'status-public'
  if (value === POST_VISIBILITY_KEYS.PRIVATE) return 'status-private'
  return 'status-hidden'
}

watch(searchQuery, () => {
  currentPage.value = 1
  selectedIds.value = []
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

onMounted(() => {
  fetchPosts()
  fetchCurrentRole()
})
</script>

<template>
  <main class="container-fluid posts-list-page py-2">
    <header class="list-header mb-3">
      <div class="title-actions">
        <div class="d-flex align-items-center gap-2">
          <h1 class="h5 fw-bold mb-0">Publicaciones</h1>
          <span v-if="!loading && !loadError" class="record-count">
            {{ filteredPosts.length ? `${pageStart + 1}–${pageEnd} de ${filteredPosts.length}` : '0' }}
          </span>
        </div>

        <div class="primary-actions d-flex gap-2">
          <router-link to="/posts/new" class="btn btn-dark action-button px-3">
            <i class="bi bi-plus-lg me-2" aria-hidden="true"></i>Nueva
          </router-link>

          <button
            v-if="canDelete && selectedIds.length"
            type="button"
            class="btn btn-outline-danger action-button px-3"
            :disabled="deleteLoading"
            @click="openDeleteModal"
          >
            <i class="bi bi-trash me-2" aria-hidden="true"></i>
            Eliminar ({{ selectedIds.length }})
          </button>
        </div>
      </div>

      <InputSearchControl
        v-model="searchQuery"
        class="list-search"
        placeholder="Buscar publicaciones"
        aria-label="Buscar publicaciones"
      />

      <div class="list-header-end">
        <div
          v-if="!loading && !loadError && filteredPosts.length"
          class="pagination-controls"
          aria-label="Paginación de publicaciones"
        >
          <button
            type="button"
            class="page-button"
            :disabled="currentPage === 1"
            :aria-label="`Página anterior. Página actual ${currentPage} de ${totalPages}`"
            title="Página anterior"
            @click="goToPreviousPage"
          >
            <i class="bi bi-arrow-left" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="page-button"
            :disabled="currentPage === totalPages"
            :aria-label="`Página siguiente. Página actual ${currentPage} de ${totalPages}`"
            title="Página siguiente"
            @click="goToNextPage"
          >
            <i class="bi bi-arrow-right" aria-hidden="true"></i>
          </button>
        </div>

      </div>
    </header>

    <section class="card border-0 shadow-sm list-card overflow-hidden" aria-live="polite">
      <div v-if="loading" class="list-state text-center">
        <div class="spinner-border spinner-border-sm text-dark" role="status">
          <span class="visually-hidden">Cargando publicaciones...</span>
        </div>
      </div>

      <div v-else-if="loadError" class="list-state text-center" role="alert">
        <p class="text-muted mb-3">{{ loadError }}</p>
        <button type="button" class="btn btn-outline-dark action-button px-3 mx-auto" @click="fetchPosts">
          Reintentar
        </button>
      </div>

      <div v-else-if="posts.length === 0" class="list-state text-center">
        <p class="text-muted mb-3">Aún no hay publicaciones.</p>
        <router-link to="/posts/new" class="btn btn-dark action-button px-3 mx-auto">Crear publicación</router-link>
      </div>

      <div v-else-if="filteredPosts.length === 0" class="list-state text-center">
        <p class="text-muted mb-3">No hay resultados para “{{ searchQuery }}”.</p>
        <button type="button" class="btn btn-outline-dark action-button px-3 mx-auto" @click="clearSearch">
          Limpiar búsqueda
        </button>
      </div>

      <div v-else class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th v-if="canDelete" scope="col" class="selection-cell">
                <input
                  type="checkbox"
                  class="form-check-input"
                  :checked="isAllSelected"
                  aria-label="Seleccionar publicaciones visibles"
                  @change="toggleSelectAll"
                >
              </th>
              <th scope="col">Publicación</th>
              <th scope="col">Estado</th>
              <th scope="col" class="d-none d-lg-table-cell">Tipo</th>
              <th scope="col" class="d-none d-md-table-cell">Fecha</th>
              <th scope="col" class="actions-cell"><span class="visually-hidden">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="post in paginatedPosts" :key="post.id" :class="{ 'is-selected': selectedIds.includes(post.id) }">
              <td v-if="canDelete" class="selection-cell">
                <input
                  v-model="selectedIds"
                  type="checkbox"
                  class="form-check-input"
                  :value="post.id"
                  :aria-label="`Seleccionar ${post.title || 'publicación'}`"
                >
              </td>
              <td class="post-cell">
                <router-link :to="`/posts/edit/${post.id}`" class="post-title">
                  {{ post.title || 'Sin título' }}
                </router-link>
                <span v-if="post.subtitle" class="post-subtitle">{{ post.subtitle }}</span>
              </td>
              <td>
                <span class="status-badge" :class="visibilityClass(post.visibility)">
                  {{ getPostVisibilityLabel(post.visibility) }}
                </span>
              </td>
              <td class="d-none d-lg-table-cell">
                <span class="post-type">{{ getPostTypeLabel(post.type_post) }}</span>
              </td>
              <td class="date-cell d-none d-md-table-cell">{{ formatDate(post.created_at) }}</td>
              <td class="actions-cell">
                <div class="d-flex justify-content-end gap-1">
                  <router-link :to="`/posts/preview/${post.id}`" class="icon-button" title="Vista previa" aria-label="Vista previa">
                    <i class="bi bi-eye" aria-hidden="true"></i>
                  </router-link>
                  <router-link :to="`/posts/edit/${post.id}`" class="icon-button" title="Editar" aria-label="Editar">
                    <i class="bi bi-pencil" aria-hidden="true"></i>
                  </router-link>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>

  <ModalDelete
    :show="showDeleteModal"
    :count="selectedIds.length"
    title="Eliminar publicaciones"
    @confirm="confirmDeleteSelected"
    @close="showDeleteModal = false"
  />
</template>

<style scoped>
.posts-list-page {
  color: #212529;
}

.list-header {
  align-items: start;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(260px, 1fr) minmax(280px, 1.2fr) minmax(100px, 0.6fr);
}

.title-actions {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.record-count {
  background: #eceff1;
  border-radius: 999px;
  color: #59636d;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.5;
  padding: 0.05rem 0.45rem;
}

.list-search {
  justify-self: center;
  max-width: 430px;
  width: 100%;
}

.list-header-end {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  justify-content: flex-end;
  min-height: 2.5rem;
}

.pagination-controls {
  border: 1px solid #d5d9dd;
  border-radius: 0.5rem;
  display: inline-flex;
  overflow: hidden;
}

.page-button {
  align-items: center;
  background: #fff;
  border: 0;
  color: #343a40;
  display: inline-flex;
  height: 2.5rem;
  justify-content: center;
  width: 2.5rem;
}

.page-button + .page-button {
  border-left: 1px solid #d5d9dd;
}

.page-button:not(:disabled):hover {
  background: #f1f3f5;
}

.page-button:disabled {
  color: #b2b8bd;
  cursor: not-allowed;
}

.page-button:focus-visible {
  box-shadow: inset 0 0 0 2px #212529;
  outline: 0;
}

.action-button {
  align-items: center;
  border-radius: 0.5rem;
  display: inline-flex;
  font-size: 0.875rem;
  font-weight: 600;
  height: 2.5rem;
  justify-content: center;
  white-space: nowrap;
}

.list-card {
  border-radius: 0.75rem;
}

.list-state {
  padding: 4rem 1.25rem;
}

.table {
  --bs-table-bg: transparent;
}

.table thead th {
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  color: #6c757d;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.75rem 1rem;
  text-transform: uppercase;
  white-space: nowrap;
}

.table tbody td {
  border-color: #edf0f2;
  padding: 0.75rem 1rem;
}

.table tbody tr:hover,
.table tbody tr.is-selected {
  background: #fafbfc;
}

.selection-cell {
  padding-left: 1.25rem !important;
  width: 3rem;
}

.form-check-input {
  cursor: pointer;
  display: block;
  height: 1rem;
  margin: 0;
  width: 1rem;
}

.post-cell {
  min-width: 220px;
  max-width: 480px;
}

.post-title {
  color: #212529;
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  overflow: hidden;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-title:hover {
  text-decoration: underline;
}

.post-subtitle {
  color: #7a828a;
  display: block;
  font-size: 0.78rem;
  margin-top: 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  border-radius: 999px;
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  white-space: nowrap;
}

.status-public {
  background: #e7f4ea;
  color: #216e39;
}

.status-private {
  background: #fff3cd;
  color: #785900;
}

.status-hidden {
  background: #eceff1;
  color: #59636d;
}

.post-type {
  color: #59636d;
  font-size: 0.78rem;
  text-transform: capitalize;
}

.date-cell {
  color: #6c757d;
  font-size: 0.78rem;
  white-space: nowrap;
}

.actions-cell {
  padding-right: 1rem !important;
  width: 5.5rem;
}

.icon-button {
  align-items: center;
  border-radius: 0.4rem;
  color: #59636d;
  display: inline-flex;
  height: 2rem;
  justify-content: center;
  text-decoration: none;
  width: 2rem;
}

.icon-button:hover {
  background: #eceff1;
  color: #212529;
}

@media (max-width: 767.98px) {
  .list-header {
    grid-template-columns: 1fr;
  }

  .list-search {
    grid-row: 1;
    justify-self: stretch;
    max-width: none;
  }

  .title-actions {
    grid-row: 2;
  }

  .list-header-end {
    align-items: flex-start;
    grid-row: 3;
    justify-content: flex-start;
  }

  .list-header-end .action-button {
    width: 100%;
  }

  .table thead th,
  .table tbody td {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .selection-cell {
    padding-left: 1rem !important;
  }

  .post-cell {
    min-width: 180px;
  }
}
</style>
