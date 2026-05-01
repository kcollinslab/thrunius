<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'

const route = useRoute()
const router = useRouter()
const post = ref(null)
const loading = ref(true)
const errorMsg = ref('')

onMounted(async () => {
  await fetchPost()
})

async function fetchPost() {
  const id = route.params.id
  loading.value = true
  
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    post.value = data
  } catch (err) {
    console.error('Error fetching post:', err)
    errorMsg.value = 'No se pudo cargar la vista previa de la publicación.'
  } finally {
    loading.value = false
  }
}

const getVisibilityBadgeClass = (visibility) => {
  switch (visibility) {
    case 'Público': return 'text-bg-success'
    case 'Privado': return 'text-bg-warning'
    case 'Oculto': return 'text-bg-secondary'
    default: return 'text-bg-light'
  }
}

function formatDate(date) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="container-fluid py-3">
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-dark" role="status">
        <span class="visually-hidden">Cargando...</span>
      </div>
    </div>

    <div v-else-if="errorMsg" class="alert alert-danger mx-auto" style="max-width: 600px;">
      <i class="bi bi-exclamation-triangle me-2"></i>{{ errorMsg }}
    </div>

    <div v-else-if="post" class="row justify-content-center">
      <!-- Columna Principal de Contenido -->
      <div class="col-md-12 col-xl-8">
        <div class="card border-0 shadow-sm overflow-hidden mb-4" style="border-radius: 0.5em;">

          <!-- Banner de Estado para el Administrador -->
          <div class="p-2 text-center small fw-bold text-uppercase" :class="getVisibilityBadgeClass(post.visibility)">
            Estado actual: {{ post.visibility }}
          </div>
          
          <div class="card-body p-4 p-md-5">
            <nav aria-label="breadcrumb" class="mb-3">
              <ol class="breadcrumb mb-0">
                <li class="breadcrumb-item small text-uppercase fw-bold">{{ post.type_post }}</li>
                <li class="breadcrumb-item active small text-uppercase" aria-current="page">{{ post.slug }}</li>
              </ol>
            </nav>

            <h1 class="display-5 fw-bold text-dark mb-3">{{ post.title }}</h1>
            <p v-if="post.subtitle" class="lead text-secondary mb-4 border-start ps-4 py-1">{{ post.subtitle }}</p>

            <div v-if="post.excerpt" class="bg-light p-4 rounded mb-5 italic-excerpt">
              <i class="bi bi-quote fs-2 text-muted opacity-25 d-block mb-n3"></i>
              <p class="mb-0 fs-5 text-muted">{{ post.excerpt }}</p>
            </div>

            <div class="post-content mb-5" v-html="post.content || '<p class=\'text-muted\'>Sin contenido disponible.</p>'"></div>

            <!-- Tags -->
            <div v-if="post.tags && post.tags.length" class="d-flex flex-wrap gap-2 pt-4 border-top">
              <span v-for="tag in post.tags" :key="tag" class="badge bg-light text-dark border fw-normal">
                #{{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Barra Lateral de Metadatos -->
      <div class="col-md-12 col-xl-4">
        <div class="card border-0 shadow-sm sticky-top" style="top: 20px; border-radius: 0.5em;">
          <div class="card-header bg-white border-bottom p-3">
            <h5 class="mb-0 fw-bold small text-uppercase text-muted">Detalles Técnicos</h5>
          </div>
          <div class="card-body p-3">
            <ul class="list-group list-group-flush small">
              <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                <span class="text-muted">ID Sistema</span>
                <code class="text-dark">{{ post.id.substring(0, 8) }}...</code>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                <span class="text-muted">Visibilidad</span>
                <span class="badge rounded-pill" :class="getVisibilityBadgeClass(post.visibility)">{{ post.visibility }}</span>
              </li>
              <li class="list-group-item px-0">
                <span class="text-muted d-block mb-1">Palabras Clave (SEO)</span>
                <p class="mb-0 fw-semibold">{{ post.keywords || 'Ninguna' }}</p>
              </li>
              <li class="list-group-item px-0">
                <span class="text-muted d-block mb-1">Fecha de Creación</span>
                <div class="d-flex align-items-center">
                  <i class="bi bi-calendar-event me-2"></i>
                  <span>{{ formatDate(post.created_at) }}</span>
                </div>
              </li>
              <li class="list-group-item px-0">
                <span class="text-muted d-block mb-1">Última Modificación</span>
                <div class="d-flex align-items-center">
                  <i class="bi bi-clock-history me-2"></i>
                  <span>{{ formatDate(post.updated_at) }}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.italic-excerpt {
  border-left: 4px solid #dee2e6;
  font-style: italic;
}

.post-content :deep(p) {
  margin-bottom: 1.25rem;
}

.post-content :deep(h1), 
.post-content :deep(h2), 
.post-content :deep(h3), 
.post-content :deep(h4), 
.post-content :deep(h5), 
.post-content :deep(h6) {
  margin-top: 2rem;
  margin-bottom: 1rem;
  font-weight: 700;
  color: #111827;
}

.post-content :deep(ul), 
.post-content :deep(ol) {
  margin-bottom: 1.25rem;
  padding-left: 1.5rem;
}

.post-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5em;
  margin: 1.5rem 0;
}

.post-content {
  line-height: 1.8;
  font-size: 1.1rem;
  color: #374151;
}

.breadcrumb-item + .breadcrumb-item::before {
  content: "•";
  color: #dee2e6;
}

.badge {
  font-size: 0.75rem;
  padding: 0.4em 0.8em;
}
</style>
