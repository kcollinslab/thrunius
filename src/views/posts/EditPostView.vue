<script setup>
import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '../../lib/supabase'
import { withTimeout, isTimeoutError } from '../../lib/asyncTimeout'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const loading = ref(true)
const updateLoading = ref(false)
const feedback = ref({ type: '', message: '' })
const loadingError = ref('')
const formSubmitted = ref(false)
const saveRedirectTimer = ref(null)
const SAVE_TIMEOUT_MS = 15000
const PUBLIC_VISIBILITY = 'Público'

function createInitialForm() {
  return {
    title: '',
    subtitle: '',
    slug: '',
    type_post: 'noticia',
    excerpt: '',
    tags: '',
    keywords: '',
    visibility: 'Oculto',
    published_at: null,
  }
}

const form = ref(createInitialForm())

const titleLength = computed(() => form.value.title?.length || 0)
const excerptLength = computed(() => form.value.excerpt?.length || 0)
const tagCount = computed(() => {
  if (!form.value.tags) return 0
  return form.value.tags.split(',').map(tag => tag.trim()).filter(Boolean).length
})
const saveButtonLabel = computed(() => updateLoading.value ? 'Guardando...' : 'Guardar cambios')
onMounted(async () => {
  try {
    const { data: { session }, error } = await withTimeout(
      supabase.auth.getSession(),
      {
        timeout: SAVE_TIMEOUT_MS,
        message: 'No se pudo validar la sesión a tiempo.',
      },
    )

    if (error) throw error
    if (!session) {
      router.push('/login')
      return
    }

    await fetchPost()
  } catch (error) {
    console.error('Error loading edit post view:', error)
    loadingError.value = getLoadErrorMessage(error)
    loading.value = false
  }
})

async function fetchPost() {
  const postId = route.params.id
  if (!postId) {
    loadingError.value = 'No se encontró el ID de la publicación.'
    loading.value = false
    return
  }

  try {
    const abortController = new AbortController()
    const { data, error } = await withTimeout(
      supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .maybeSingle()
        .abortSignal(abortController.signal),
      {
        timeout: SAVE_TIMEOUT_MS,
        message: 'No se pudo cargar la publicación a tiempo.',
        onTimeout: () => abortController.abort(),
      },
    )

    if (error) throw error

    if (!data) {
      loadingError.value = 'No se encontró la publicación o no tienes permiso para editarla.'
      return
    }

    form.value = {
      ...createInitialForm(),
      title: data.title || '',
      subtitle: data.subtitle || '',
      slug: data.slug || '',
      type_post: data.type_post || 'noticia',
      excerpt: data.excerpt || '',
      tags: normalizeTags(data.tags).join(', '),
      keywords: data.keywords || '',
      visibility: data.visibility || 'Oculto',
      published_at: data.published_at || null,
    }
  } catch (error) {
    console.error('Error fetching post:', error)
    loadingError.value = getLoadErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function handleUpdatePost() {
  if (updateLoading.value) return

  formSubmitted.value = true

  if (!form.value.title?.trim() || !form.value.slug?.trim()) {
    feedback.value = { type: 'danger', message: 'El título y el slug son obligatorios.' }
    return
  }

  updateLoading.value = true
  feedback.value = { type: '', message: '' }

  try {
    const { data: { session }, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      {
        timeout: SAVE_TIMEOUT_MS,
        message: 'No se pudo validar la sesión a tiempo.',
      },
    )

    if (sessionError) throw sessionError
    if (!session?.user) {
      router.push('/login')
      return
    }

    const tagsArray = normalizeTags(form.value.tags)

    const updatePayload = {
      title: form.value.title.trim(),
      subtitle: form.value.subtitle?.trim() || null,
      slug: form.value.slug.trim(),
      type_post: form.value.type_post,
      excerpt: form.value.excerpt?.trim() || null,
      tags: tagsArray,
      keywords: form.value.keywords?.trim() || null,
      visibility: form.value.visibility,
      editor_id: session.user.id,
      updated_at: new Date().toISOString(),
      published_at: form.value.visibility === PUBLIC_VISIBILITY
        ? form.value.published_at || new Date().toISOString()
        : null,
    }

    const abortController = new AbortController()
    const { data, error } = await withTimeout(
      supabase
        .from('posts')
        .update(updatePayload)
        .eq('id', route.params.id)
        .select('id')
        .maybeSingle()
        .abortSignal(abortController.signal),
      {
        timeout: SAVE_TIMEOUT_MS,
        message: 'La actualización tardó demasiado. Revisa tu conexión e inténtalo de nuevo.',
        onTimeout: () => abortController.abort(),
      },
    )

    if (error) throw error
    if (!data?.id) throw new Error('No se actualizó ninguna publicación.')

    toast.success('Publicación actualizada correctamente.')

    saveRedirectTimer.value = setTimeout(() => {
      router.push('/posts')
    }, 1500)
  } catch (error) {
    console.error('Error updating post:', error)
    feedback.value = {
      type: 'danger',
      message: getUpdateErrorMessage(error),
    }
  } finally {
    updateLoading.value = false
  }
}

function normalizeTags(tagsValue) {
  const values = Array.isArray(tagsValue)
    ? tagsValue
    : String(tagsValue || '').split(',')

  return [...new Set(values.map(tag => String(tag).trim()).filter(Boolean))]
}

function getLoadErrorMessage(error) {
  if (isTimeoutError(error)) {
    return 'La carga tardó demasiado. Revisa tu conexión e inténtalo de nuevo.'
  }

  return error?.message || 'No se pudo cargar la publicación.'
}

async function retryFetchPost() {
  loadingError.value = ''
  loading.value = true
  await fetchPost()
}

function getUpdateErrorMessage(error) {
  if (isTimeoutError(error)) {
    return 'La actualización tardó demasiado. Revisa tu conexión e inténtalo de nuevo.'
  }

  if (error?.code === '23505') {
    return 'El slug ya existe. Prueba con otro título o modifícalo.'
  }

  if (error?.code === 'PGRST116') {
    return 'No se encontró la publicación o no tienes permiso para actualizarla.'
  }

  return error?.message || 'Error al actualizar la publicación.'
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
}

function updateSlug() {
  if (form.value.title) {
    form.value.slug = slugify(form.value.title)
  }
}

onBeforeUnmount(() => {
  if (saveRedirectTimer.value) clearTimeout(saveRedirectTimer.value)
})
</script>

<template>
  <div class="container py-3 edit-post-view">
    <div class="row justify-content-center">
      <div class="col-12 col-xxl-10">
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border text-dark" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p class="text-muted small mt-3 mb-0">Cargando publicación...</p>
        </div>

        <div v-else-if="loadingError" class="edit-state-card text-center">
          <i class="bi bi-file-earmark-x" aria-hidden="true"></i>
          <h1 class="h5 mb-2">No se pudo abrir la publicación</h1>
          <p class="text-muted mb-4">{{ loadingError }}</p>
          <div class="d-flex flex-column flex-sm-row justify-content-center gap-2">
            <button type="button" class="btn btn-dark px-4" @click="retryFetchPost">
              Reintentar
            </button>
            <router-link to="/posts" class="btn btn-light border px-4">
              Volver a publicaciones
            </router-link>
          </div>
        </div>

        <div v-else class="edit-post-card">
          <div class="card-body p-3 p-lg-4">
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
              <button
                type="button"
                class="btn-close"
                aria-label="Cerrar mensaje"
                @click="feedback.message = ''"
              ></button>
            </div>

            <form novalidate @submit.prevent="handleUpdatePost">
              <section class="form-section border-bottom pb-4 mb-4">
                <div class="d-flex flex-column flex-lg-row justify-content-between gap-2 mb-3">
                  <div>
                    <p class="section-kicker mb-1">Contenido principal</p>
                    <h3 class="section-title mb-0">Título y resumen</h3>
                  </div>
                </div>

                <div class="mb-3">
                  <div class="d-flex justify-content-between gap-3">
                    <label class="form-label fw-semibold" for="post-title">Título <span class="text-danger">*</span></label>
                    <span class="form-hint">{{ titleLength }} caracteres</span>
                  </div>
                  <input
                    id="post-title"
                    v-model="form.title"
                    type="text"
                    class="form-control form-control-lg"
                    :class="{ 'is-invalid': formSubmitted && !form.title?.trim() }"
                    placeholder="Escribe un título claro para la publicación"
                    required
                  >
                  <div class="invalid-feedback">El título es obligatorio.</div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold" for="post-subtitle">Subtítulo</label>
                  <input
                    id="post-subtitle"
                    v-model="form.subtitle"
                    type="text"
                    class="form-control"
                    placeholder="Agrega una idea secundaria si la publicación lo necesita"
                  >
                </div>

                <div>
                  <div class="d-flex justify-content-between gap-3">
                    <label class="form-label fw-semibold" for="post-excerpt">Resumen corto</label>
                    <span class="form-hint">{{ excerptLength }} caracteres</span>
                  </div>
                  <textarea
                    id="post-excerpt"
                    v-model="form.excerpt"
                    class="form-control"
                    rows="3"
                    placeholder="Una descripción breve para listados y vistas previas"
                  ></textarea>
                  <div class="form-text">Procura que explique el valor de la publicación en una o dos frases.</div>
                </div>
              </section>

              <section class="form-section border-bottom pb-4 mb-4">
                <div class="mb-3">
                  <p class="section-kicker mb-1">Publicación</p>
                  <h3 class="section-title mb-0">Ruta, tipo y visibilidad</h3>
                </div>

                <div class="row g-3">
                  <div class="col-12 col-lg-6">
                    <label class="form-label fw-semibold" for="post-slug">Slug <span class="text-danger">*</span></label>
                    <div class="input-group">
                      <span class="input-group-text bg-light text-muted small">/posts/</span>
                      <input
                        id="post-slug"
                        v-model="form.slug"
                        type="text"
                        class="form-control"
                        :class="{ 'is-invalid': formSubmitted && !form.slug?.trim() }"
                        placeholder="titulo-de-la-noticia"
                        required
                      >
                      <button class="btn btn-outline-dark" type="button" @click="updateSlug">
                        Sugerir
                      </button>
                      <div class="invalid-feedback">El slug es obligatorio.</div>
                    </div>
                    <div class="form-text text-break">URL: /posts/{{ form.slug || 'slug-de-la-publicacion' }}</div>
                  </div>

                  <div class="col-12 col-sm-6 col-lg-3">
                    <label class="form-label fw-semibold" for="post-type">Tipo</label>
                    <select id="post-type" v-model="form.type_post" class="form-select">
                      <option value="noticia">Noticia</option>
                      <option value="aviso">Aviso</option>
                      <option value="blog">Blog</option>
                      <option value="evento">Evento</option>
                    </select>
                  </div>

                  <div class="col-12 col-sm-6 col-lg-3">
                    <label class="form-label fw-semibold" for="post-visibility">Visibilidad</label>
                    <select id="post-visibility" v-model="form.visibility" class="form-select">
                      <option value="Oculto">Oculto</option>
                      <option value="Privado">Privado</option>
                      <option value="Público">Público</option>
                    </select>
                    <div class="form-text">Público asigna fecha de publicación al guardar.</div>
                  </div>
                </div>
              </section>

              <section class="form-section mb-4">
                <div class="mb-3">
                  <p class="section-kicker mb-1">Búsqueda</p>
                  <h3 class="section-title mb-0">Etiquetas y SEO</h3>
                </div>

                <div class="row g-3">
                  <div class="col-12 col-lg-6">
                    <div class="d-flex justify-content-between gap-3">
                      <label class="form-label fw-semibold" for="post-tags">Etiquetas</label>
                      <span class="form-hint">{{ tagCount }} etiquetas</span>
                    </div>
                    <input
                      id="post-tags"
                      v-model="form.tags"
                      type="text"
                      class="form-control"
                      placeholder="tecnología, eventos, nacional"
                    >
                    <div class="form-text">Separa cada etiqueta con una coma.</div>
                  </div>

                  <div class="col-12 col-lg-6">
                    <label class="form-label fw-semibold" for="post-keywords">Palabras clave SEO</label>
                    <input
                      id="post-keywords"
                      v-model="form.keywords"
                      type="text"
                      class="form-control"
                      placeholder="frases clave separadas por comas"
                    >
                    <div class="form-text">Ayudan a describir el tema de la publicación.</div>
                  </div>
                </div>
              </section>

              <div class="form-actions border-top pt-3">
                <div class="action-stack">
                  <button
                    type="submit"
                    class="btn btn-dark px-4"
                    :disabled="updateLoading"
                  >
                    <span v-if="updateLoading" class="spinner-border spinner-border-sm me-2"></span>
                    {{ saveButtonLabel }}
                  </button>
                  <router-link to="/posts" class="btn btn-light border px-4">
                    Cancelar
                  </router-link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-post-view {
  min-height: calc(100vh - 4rem);
}

.edit-post-card {
  border-radius: 0.5em;
}

.edit-state-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #ffffff;
  box-shadow: 0 0.5rem 1.5rem rgba(17, 24, 39, 0.06);
  padding: clamp(2rem, 6vw, 4rem) 1.25rem;
}

.edit-state-card > i {
  display: block;
  margin-bottom: 1rem;
  color: #9ca3af;
  font-size: 2.5rem;
}

.edit-post-card > .card-body {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #ffffff;
  box-shadow: 0 0.5rem 1.5rem rgba(17, 24, 39, 0.06);
}

.section-kicker {
  color: #6c757d;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.section-title {
  color: #111827;
  font-size: 1rem;
  font-weight: 700;
}

.form-hint {
  color: #6c757d;
  flex-shrink: 0;
  font-size: 0.8rem;
}

.form-control,
.form-select,
.input-group-text,
.btn {
  border-radius: 0.5em;
}

.input-group > .form-control {
  border-radius: 0;
}

.input-group > .input-group-text {
  border-bottom-right-radius: 0;
  border-top-right-radius: 0;
}

.input-group > .btn {
  border-bottom-left-radius: 0;
  border-top-left-radius: 0;
}

.form-control:focus,
.form-select:focus {
  border-color: #212529;
  box-shadow: 0 0 0 0.2rem rgba(33, 37, 41, 0.12);
}

.form-actions .btn {
  background: #ffffff;
  align-items: center;
  display: inline-flex;
  justify-content: center;
  line-height: 1.2;
  min-height: 44px;
  padding-bottom: 0.625rem;
  padding-top: 0.625rem;
}

.form-actions {
  position: sticky;
  bottom: 0;
  z-index: 1;
  margin-inline: -0.25rem;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 -0.5rem 1rem rgba(255, 255, 255, 0.9);
}

.action-stack {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
  width: min(100%, 22rem);
  margin-left: auto;
}

.action-stack .btn {
  flex: 1 1 0;
}

.form-actions .btn-dark {
  background: #111827;
}

.form-actions .spinner-border {
  flex-shrink: 0;
}

@media (max-width: 575.98px) {
  .action-stack {
    width: 100%;
  }
}
</style>
