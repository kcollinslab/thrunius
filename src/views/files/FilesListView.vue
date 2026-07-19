<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '../../lib/supabase'
import ModalDelete from '../../components/ModalDelete.vue'
import InputSearchControl from '../../components/tools/InputSearchControl.vue'

const toast = useToast()

const files = ref([])
const searchQuery = ref('')
const loading = ref(true)
const loadError = ref('')
const currentRole = ref('')
const selectedIds = ref([])
const showDeleteModal = ref(false)
const deleteLoading = ref(false)
const currentPage = ref(1)
const failedPreviewIds = ref(new Set())

const PAGE_SIZE = 20
const FILE_MANAGER_ROLES = ['admin', 'editor']

const canManageFiles = computed(() => FILE_MANAGER_ROLES.includes(currentRole.value))

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getRelationshipLabel(file) {
  if (file.posts?.title) return file.posts.title
  if (file.user_id) return 'Perfil de usuario'
  return 'Sin relación'
}

const filteredFiles = computed(() => {
  const query = normalizeText(searchQuery.value.trim())
  if (!query) return files.value

  return files.value.filter((file) => [
    file.title,
    file.file_name,
    file.extension,
    file.mime_type,
    getRelationshipLabel(file),
  ].some((value) => normalizeText(value).includes(query)))
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredFiles.value.length / PAGE_SIZE)))
const pageStart = computed(() => (currentPage.value - 1) * PAGE_SIZE)
const pageEnd = computed(() => Math.min(pageStart.value + PAGE_SIZE, filteredFiles.value.length))
const paginatedFiles = computed(() => filteredFiles.value.slice(pageStart.value, pageEnd.value))
const visibleIds = computed(() => paginatedFiles.value.map((file) => file.id))
const isAllSelected = computed(() => (
  canManageFiles.value
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
    console.error('Error al validar permisos de archivos:', error)
    currentRole.value = ''
  }
}

async function fetchFiles() {
  loading.value = true
  loadError.value = ''
  selectedIds.value = []
  currentPage.value = 1
  failedPreviewIds.value = new Set()

  try {
    const { data, error } = await supabase
      .from('files')
      .select(`
        id,
        bucket_id,
        file_name,
        extension,
        storage_path,
        thumbnail_path,
        mime_type,
        size_bytes,
        is_image,
        width,
        height,
        title,
        user_id,
        created_at,
        posts (id, title)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    files.value = data || []
  } catch (error) {
    console.error('Error al cargar archivos:', error)
    loadError.value = 'No se pudieron cargar los archivos.'
  } finally {
    loading.value = false
  }
}

async function assertFileManagerPermission() {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('AUTH_REQUIRED')

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  const role = String(data?.role || '').trim().toLowerCase()
  if (error || !FILE_MANAGER_ROLES.includes(role)) throw new Error('MANAGER_REQUIRED')
}

function getFileUrl(storagePath, bucketId = 'media') {
  if (!storagePath) return ''
  return supabase.storage.from(bucketId || 'media').getPublicUrl(storagePath).data.publicUrl
}

function canShowPreview(file) {
  return Boolean(file.is_image && !failedPreviewIds.value.has(file.id))
}

function handlePreviewError(fileId) {
  failedPreviewIds.value = new Set([...failedPreviewIds.value, fileId])
}

function formatSize(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const size = value / (1024 ** unitIndex)
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
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

function toggleSelectAll(event) {
  if (!canManageFiles.value) return

  if (event.target.checked) {
    selectedIds.value = [...new Set([...selectedIds.value, ...visibleIds.value])]
    return
  }

  selectedIds.value = selectedIds.value.filter((id) => !visibleIds.value.includes(id))
}

function openDeleteModal() {
  if (canManageFiles.value && selectedIds.value.length > 0) showDeleteModal.value = true
}

function groupStoragePaths(filesToDelete) {
  const pathsByBucket = new Map()

  for (const file of filesToDelete) {
    const bucket = file.bucket_id || 'media'
    const paths = pathsByBucket.get(bucket) || new Set()
    if (file.storage_path) paths.add(file.storage_path)
    if (file.thumbnail_path) paths.add(file.thumbnail_path)
    pathsByBucket.set(bucket, paths)
  }

  return pathsByBucket
}

async function confirmDeleteSelected() {
  if (deleteLoading.value || selectedIds.value.length === 0) return

  const idsToDelete = [...selectedIds.value]
  const filesToDelete = files.value.filter((file) => idsToDelete.includes(file.id))
  deleteLoading.value = true
  showDeleteModal.value = false

  try {
    await assertFileManagerPermission()
    if (filesToDelete.length !== idsToDelete.length) throw new Error('FILES_NOT_FOUND')

    const { data, error } = await supabase
      .from('files')
      .delete()
      .in('id', idsToDelete)
      .select('id')

    if (error) throw error
    if ((data?.length || 0) !== idsToDelete.length) throw new Error('DELETE_INCOMPLETE')

    let storageCleanupFailed = false

    for (const [bucket, pathSet] of groupStoragePaths(filesToDelete)) {
      const paths = [...pathSet]
      if (!paths.length) continue

      const { error: storageError } = await supabase.storage.from(bucket).remove(paths)
      if (storageError) {
        storageCleanupFailed = true
        console.warn(`No se pudieron limpiar todos los objetos del bucket ${bucket}:`, storageError)
      }
    }

    if (storageCleanupFailed) {
      toast.warning('Los registros se eliminaron, pero algunos objetos requieren limpieza en Storage.')
    } else {
      toast.success(idsToDelete.length === 1
        ? 'Archivo eliminado correctamente.'
        : `${idsToDelete.length} archivos eliminados correctamente.`)
    }
    await fetchFiles()
  } catch (error) {
    console.error('Error al eliminar archivos:', error)

    const message = error.message === 'MANAGER_REQUIRED'
      ? 'No tienes permisos para eliminar archivos.'
      : error.message === 'AUTH_REQUIRED'
        ? 'Tu sesión expiró. Inicia sesión nuevamente.'
        : 'No se pudieron eliminar los archivos.'
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

watch(searchQuery, () => {
  currentPage.value = 1
  selectedIds.value = []
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

onMounted(() => {
  fetchFiles()
  fetchCurrentRole()
})
</script>

<template>
  <main class="container-fluid files-list-page py-2">
    <header class="list-header mb-3">
      <div class="title-actions">
        <div class="d-flex align-items-center gap-2">
          <h1 class="h5 fw-bold mb-0">Archivos</h1>
          <span v-if="!loading && !loadError" class="record-count">
            {{ filteredFiles.length ? `${pageStart + 1}–${pageEnd} de ${filteredFiles.length}` : '0' }}
          </span>
        </div>

        <div v-if="canManageFiles" class="primary-actions d-flex gap-2">
          <router-link to="/files/new" class="btn btn-dark action-button px-3">
            <i class="bi bi-plus-lg me-2" aria-hidden="true"></i>Subir
          </router-link>

          <button
            v-if="selectedIds.length"
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
        placeholder="Buscar archivos"
        aria-label="Buscar archivos"
      />

      <div class="list-header-end">
        <nav
          v-if="!loading && !loadError && filteredFiles.length"
          class="pagination-controls"
          aria-label="Paginación de archivos"
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
        </nav>
      </div>
    </header>

    <section class="card border-0 shadow-sm list-card overflow-hidden" aria-live="polite">
      <div v-if="loading" class="list-state text-center">
        <div class="spinner-border spinner-border-sm text-dark" role="status">
          <span class="visually-hidden">Cargando archivos...</span>
        </div>
      </div>

      <div v-else-if="loadError" class="list-state text-center" role="alert">
        <p class="text-muted mb-3">{{ loadError }}</p>
        <button type="button" class="btn btn-outline-dark action-button px-3 mx-auto" @click="fetchFiles">
          Reintentar
        </button>
      </div>

      <div v-else-if="files.length === 0" class="list-state text-center">
        <p class="text-muted mb-3">Aún no hay archivos.</p>
        <router-link v-if="canManageFiles" to="/files/new" class="btn btn-dark action-button px-3 mx-auto">
          Subir archivo
        </router-link>
      </div>

      <div v-else-if="filteredFiles.length === 0" class="list-state text-center">
        <p class="text-muted mb-3">No hay resultados para “{{ searchQuery }}”.</p>
        <button type="button" class="btn btn-outline-dark action-button px-3 mx-auto" @click="clearSearch">
          Limpiar búsqueda
        </button>
      </div>

      <div v-else class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th v-if="canManageFiles" scope="col" class="selection-cell">
                <input
                  type="checkbox"
                  class="form-check-input"
                  :checked="isAllSelected"
                  aria-label="Seleccionar archivos visibles"
                  @change="toggleSelectAll"
                >
              </th>
              <th scope="col">Archivo</th>
              <th scope="col" class="d-none d-lg-table-cell">Relacionado con</th>
              <th scope="col" class="d-none d-xl-table-cell">Tamaño</th>
              <th scope="col" class="d-none d-md-table-cell">Fecha</th>
              <th scope="col" class="actions-cell"><span class="visually-hidden">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in paginatedFiles" :key="file.id" :class="{ 'is-selected': selectedIds.includes(file.id) }">
              <td v-if="canManageFiles" class="selection-cell">
                <input
                  v-model="selectedIds"
                  type="checkbox"
                  class="form-check-input"
                  :value="file.id"
                  :aria-label="`Seleccionar ${file.title || file.file_name || 'archivo'}`"
                >
              </td>
              <td class="file-cell">
                <div class="d-flex align-items-center gap-3">
                  <div class="file-preview" aria-hidden="true">
                    <img
                      v-if="canShowPreview(file)"
                      :src="getFileUrl(file.thumbnail_path || file.storage_path, file.bucket_id)"
                      alt=""
                      loading="lazy"
                      @error="handlePreviewError(file.id)"
                    >
                    <i v-else class="bi bi-file-earmark-text"></i>
                  </div>
                  <div class="file-copy">
                    <router-link
                      v-if="canManageFiles"
                      :to="`/files/edit/${file.id}`"
                      class="file-title"
                    >
                      {{ file.title || file.file_name || 'Sin nombre' }}
                    </router-link>
                    <span v-else class="file-title">{{ file.title || file.file_name || 'Sin nombre' }}</span>
                    <span class="file-meta">
                      {{ file.extension || 'archivo' }}<template v-if="file.mime_type"> · {{ file.mime_type }}</template>
                    </span>
                  </div>
                </div>
              </td>
              <td class="relationship-cell d-none d-lg-table-cell">
                <router-link v-if="file.posts" :to="`/posts/preview/${file.posts.id}`" class="relationship-link">
                  {{ file.posts.title }}
                </router-link>
                <span v-else>{{ getRelationshipLabel(file) }}</span>
              </td>
              <td class="size-cell d-none d-xl-table-cell">
                {{ formatSize(file.size_bytes) }}
                <span v-if="file.width && file.height">{{ file.width }} × {{ file.height }} px</span>
              </td>
              <td class="date-cell d-none d-md-table-cell">{{ formatDate(file.created_at) }}</td>
              <td class="actions-cell">
                <div class="d-flex justify-content-end gap-1">
                  <a
                    :href="getFileUrl(file.storage_path, file.bucket_id)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="icon-button"
                    title="Abrir archivo"
                    aria-label="Abrir archivo"
                  >
                    <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                  </a>
                  <router-link
                    v-if="canManageFiles"
                    :to="`/files/edit/${file.id}`"
                    class="icon-button"
                    title="Editar metadatos"
                    aria-label="Editar metadatos"
                  >
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
    title="Eliminar archivos"
    @confirm="confirmDeleteSelected"
    @close="showDeleteModal = false"
  />
</template>

<style scoped>
.files-list-page {
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
  line-height: 1;
  padding-bottom: 0;
  padding-top: 0;
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
  table-layout: fixed;
  width: 100%;
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

.file-cell {
  width: auto;
}

.file-preview {
  align-items: center;
  background: #f1f3f5;
  border-radius: 0.45rem;
  color: #7a828a;
  display: flex;
  flex: 0 0 auto;
  font-size: 1.2rem;
  height: 2.75rem;
  justify-content: center;
  overflow: hidden;
  width: 2.75rem;
}

.file-preview img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.file-copy {
  min-width: 0;
}

.file-title {
  color: #212529;
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  overflow: hidden;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

a.file-title:hover {
  text-decoration: underline;
}

.file-meta {
  color: #7a828a;
  display: block;
  font-size: 0.72rem;
  margin-top: 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: lowercase;
  white-space: nowrap;
}

.relationship-cell,
.size-cell,
.date-cell {
  color: #6c757d;
  font-size: 0.78rem;
}

.relationship-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 22%;
}

.relationship-link {
  color: #495057;
  text-decoration: none;
}

.relationship-link:hover {
  text-decoration: underline;
}

.size-cell,
.date-cell {
  white-space: nowrap;
}

.size-cell {
  width: 8.5rem;
}

.date-cell {
  width: 8rem;
}

.size-cell span {
  display: block;
  font-size: 0.7rem;
  margin-top: 0.1rem;
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

@media (max-width: 991.98px) {
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
}

@media (max-width: 767.98px) {
  .table {
    table-layout: fixed;
  }

  .table thead th,
  .table tbody td {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .selection-cell {
    padding-left: 0.75rem !important;
    padding-right: 0.25rem !important;
    width: 2.5rem;
  }

  .file-cell {
    min-width: 0;
    width: auto;
  }

  .file-cell .gap-3 {
    gap: 0.65rem !important;
  }

  .file-preview {
    height: 2.25rem;
    width: 2.25rem;
  }

  .actions-cell {
    padding-left: 0.25rem !important;
    padding-right: 0.5rem !important;
    width: 4.75rem;
  }
}

@media (max-width: 419.98px) {
  .file-preview {
    display: none;
  }

  .primary-actions {
    align-items: stretch;
    flex-direction: column;
    width: 100%;
  }

  .primary-actions .action-button {
    width: 100%;
  }
}
</style>
