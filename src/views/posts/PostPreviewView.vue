<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import {
  POST_VISIBILITY_KEYS,
  getPostTypeLabel,
  getPostVisibilityLabel,
  normalizePostVisibility,
} from '../../constants/catalogs'

const route = useRoute()

const post = ref(null)
const images = ref([])
const loading = ref(true)
const loadError = ref('')

const postId = computed(() => String(route.params.id || '').trim())
const heroImage = computed(() => images.value[0] || null)
const galleryImages = computed(() => images.value.slice(1))
const tags = computed(() => normalizeTags(post.value?.tags))

async function fetchPost() {
  loading.value = true
  loadError.value = ''
  post.value = null
  images.value = []

  if (!hasSupabaseConfig || !supabase) {
    loadError.value = 'Supabase no está configurado en esta aplicación.'
    loading.value = false
    return
  }

  if (!postId.value) {
    loadError.value = 'No se encontró la publicación solicitada.'
    loading.value = false
    return
  }

  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        subtitle,
        slug,
        excerpt,
        content,
        tags,
        keywords,
        type_post,
        visibility,
        published_at,
        created_at,
        updated_at
      `)
      .eq('id', postId.value)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      loadError.value = 'La publicación no existe o no tienes permiso para verla.'
      return
    }

    post.value = data
    images.value = await fetchPostImages(data.id)
  } catch (error) {
    console.error('Error al cargar vista previa:', error)
    loadError.value = 'No se pudo cargar la vista previa. Intenta nuevamente.'
  } finally {
    loading.value = false
  }
}

async function fetchPostImages(postIdValue) {
  if (!postIdValue) return []

  try {
    const { data, error } = await supabase
      .from('files')
      .select(`
        id,
        bucket_id,
        storage_path,
        thumbnail_path,
        title,
        alt_text,
        is_main,
        created_at
      `)
      .eq('post_id', postIdValue)
      .eq('is_image', true)
      .order('is_main', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) throw error

    return (data || [])
      .map((file) => {
        const storagePath = file.storage_path || file.thumbnail_path
        const previewPath = file.thumbnail_path || file.storage_path
        if (!storagePath || !previewPath) return null

        const bucket = file.bucket_id || 'media'
        return {
          id: file.id,
          title: file.title || '',
          alt: file.alt_text || file.title || post.value?.title || '',
          url: supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl,
          previewUrl: supabase.storage.from(bucket).getPublicUrl(previewPath).data.publicUrl,
        }
      })
      .filter(Boolean)
  } catch (error) {
    console.warn('No se pudieron cargar imágenes de la publicación:', error)
    return []
  }
}

function normalizeTags(tagsValue) {
  if (!tagsValue) return []
  if (Array.isArray(tagsValue)) return tagsValue.filter(Boolean)

  return String(tagsValue)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ')
}

function getSummary(postValue) {
  return postValue?.excerpt || postValue?.subtitle || ''
}

function getReadingTime(postValue) {
  const words = stripHtml(`${postValue?.title || ''} ${postValue?.excerpt || ''} ${postValue?.content || ''}`)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length

  return `${Math.max(1, Math.ceil(words / 220))} min de lectura`
}

function formatDate(value) {
  if (!value) return 'Fecha por confirmar'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar'

  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function getVisibilityClass(visibility) {
  const value = normalizePostVisibility(visibility)

  return {
    'preview-status-public': value === POST_VISIBILITY_KEYS.PUBLIC,
    'preview-status-private': value === POST_VISIBILITY_KEYS.PRIVATE,
    'preview-status-hidden': value === POST_VISIBILITY_KEYS.HIDDEN,
  }
}

watch(postId, fetchPost)
onMounted(fetchPost)
</script>

<template>
  <main class="article-read post-preview">
    <section v-if="loading" class="read-state">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
      <span>Cargando vista previa...</span>
    </section>

    <section v-else-if="loadError" class="read-state read-state-error" role="alert">
      <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
      <span>{{ loadError }}</span>
      <div class="state-actions">
        <button type="button" class="read-button" @click="fetchPost">Reintentar</button>
        <RouterLink to="/posts" class="read-button read-button-light">Volver a publicaciones</RouterLink>
      </div>
    </section>

    <template v-else-if="post">
      <header class="article-header">
        <div class="read-shell">
          <RouterLink to="/posts" class="back-link">
            <i class="bi bi-arrow-left" aria-hidden="true"></i>
            Publicaciones
          </RouterLink>

          <h1>{{ post.title || 'Publicación sin título' }}</h1>
          <p v-if="post.subtitle" class="article-subtitle">{{ post.subtitle }}</p>

          <div class="article-meta">
            <span>{{ formatDate(post.published_at || post.created_at) }}</span>
            <span>{{ getReadingTime(post) }}</span>
          </div>
        </div>
      </header>

      <section class="read-shell article-layout">
        <article class="article-content">
          <figure class="hero-media">
            <img
              v-if="heroImage?.url"
              :src="heroImage.url"
              :alt="heroImage.alt || post.title"
              loading="eager"
            >
            <div v-else class="hero-placeholder">
              <i class="bi bi-newspaper" aria-hidden="true"></i>
            </div>
            <figcaption v-if="heroImage?.title">{{ heroImage.title }}</figcaption>
          </figure>

          <p v-if="getSummary(post)" class="article-summary">
            {{ getSummary(post) }}
          </p>

          <div v-if="post.content" class="article-body" v-html="post.content"></div>

          <div v-else class="article-body">
            <p>Esta publicación aún no tiene contenido disponible.</p>
          </div>

          <section v-if="galleryImages.length" class="article-gallery" aria-label="Galería de la publicación">
            <h2>Galería</h2>
            <div class="gallery-grid">
              <a
                v-for="image in galleryImages"
                :key="image.id"
                :href="image.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img :src="image.previewUrl" :alt="image.alt || post.title" loading="lazy">
              </a>
            </div>
          </section>
        </article>

        <aside class="article-sidebar">
          <section class="side-panel">
            <h2>Detalles</h2>
            <dl>
              <div>
                <dt>Publicado</dt>
                <dd>{{ formatDate(post.published_at || post.created_at) }}</dd>
              </div>
              <div>
                <dt>Lectura</dt>
                <dd>{{ getReadingTime(post) }}</dd>
              </div>
            </dl>
          </section>

          <section class="side-panel">
            <h2>Vista previa</h2>
            <dl>
              <div>
                <dt>Estado</dt>
                <dd>
                  <span class="preview-status" :class="getVisibilityClass(post.visibility)">
                    {{ getPostVisibilityLabel(post.visibility) }}
                  </span>
                </dd>
              </div>
              <div v-if="post.type_post">
                <dt>Tipo</dt>
                <dd>{{ getPostTypeLabel(post.type_post) }}</dd>
              </div>
              <div>
                <dt>Actualizado</dt>
                <dd>{{ formatDate(post.updated_at || post.created_at) }}</dd>
              </div>
              <div v-if="post.keywords">
                <dt>SEO</dt>
                <dd>{{ post.keywords }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="tags.length" class="side-panel">
            <h2>Temas</h2>
            <div class="tag-list">
              <span v-for="tag in tags" :key="tag">#{{ tag }}</span>
            </div>
          </section>
        </aside>
      </section>
    </template>
  </main>
</template>

<style scoped>
.article-read {
  min-height: 100vh;
  background: #f7f7f7;
  color: #111111;
}

.read-shell {
  width: min(100%, 1120px);
  margin: 0 auto;
  padding-inline: clamp(1rem, 3vw, 2rem);
}

.read-state {
  display: flex;
  min-height: 60vh;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: #625d55;
  text-align: center;
}

.read-state-error {
  flex-direction: column;
  color: #111111;
}

.state-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.read-button,
.back-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: 0.35rem;
  font-size: 0.84rem;
  font-weight: 700;
  text-decoration: none;
}

.read-button {
  min-height: 2.5rem;
  border: 1px solid #111111;
  background: #111111;
  color: #ffffff;
  padding: 0.55rem 0.9rem;
}

.read-button-light {
  background: #ffffff;
  color: #111111;
}

.article-header {
  border-bottom: 1px solid #e5e5e5;
  background: #ffffff;
}

.article-header .read-shell {
  padding-top: clamp(1.25rem, 4vw, 3rem);
  padding-bottom: clamp(1.5rem, 4vw, 3rem);
}

.back-link {
  color: #5f5f5f;
  margin-bottom: 1.25rem;
}

.back-link:hover {
  color: #111111;
}

.article-header h1 {
  max-width: 820px;
  margin: 0 0 0.9rem;
  color: #111111;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: clamp(1.95rem, 4.8vw, 3.5rem);
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.05;
}

.article-subtitle {
  max-width: 780px;
  margin: 0;
  color: #4f4f4f;
  font-size: clamp(1rem, 1.7vw, 1.22rem);
  line-height: 1.55;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  margin-top: 1.25rem;
  color: #737373;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
}

.article-meta span + span::before {
  content: '•';
  margin-right: 0.8rem;
  color: #b3b3b3;
}

.preview-status {
  display: inline-flex;
  align-items: center;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  padding: 0.35rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1;
}

.preview-status-public {
  border-color: #b7dfc2;
  background: #effaf1;
  color: #216e39;
}

.preview-status-private {
  border-color: #f0d69a;
  background: #fff8e6;
  color: #8a5a00;
}

.preview-status-hidden {
  border-color: #d1d5db;
  background: #f3f4f6;
  color: #4b5563;
}

.article-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18rem;
  gap: clamp(1.25rem, 4vw, 3rem);
  padding-top: 1.5rem;
  padding-bottom: clamp(2rem, 5vw, 4rem);
}

.article-content {
  min-width: 0;
}

.hero-media {
  margin: 0 0 1.5rem;
  border: 1px solid #e5e5e5;
  background: #ffffff;
}

.hero-media img,
.hero-placeholder {
  width: 100%;
  aspect-ratio: 16 / 9;
}

.hero-media img {
  display: block;
  object-fit: cover;
}

.hero-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(135deg, rgba(17, 17, 17, 0.08), transparent 36%),
    repeating-linear-gradient(0deg, #ededed, #ededed 1px, #fafafa 1px, #fafafa 9px);
  color: #111111;
  font-size: 3rem;
}

.hero-media figcaption {
  padding: 0.65rem 0.85rem;
  color: #737373;
  font-size: 0.78rem;
}

.article-summary {
  margin: 0 0 1.5rem;
  padding: 1rem 0 1rem 1.25rem;
  border-left: 4px solid #111111;
  color: #333333;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(1.2rem, 2vw, 1.55rem);
  line-height: 1.45;
}

.article-body {
  border-top: 1px solid #e5e5e5;
  padding-top: 1.5rem;
}

.article-body p {
  margin: 0 0 1.25rem;
  color: #303030;
  font-size: 1.05rem;
  line-height: 1.85;
}

.article-gallery {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e5e5;
}

.article-gallery h2,
.side-panel h2 {
  margin: 0 0 0.8rem;
  color: #111111;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.gallery-grid a {
  display: block;
  border: 1px solid #e5e5e5;
  background: #ffffff;
  overflow: hidden;
}

.gallery-grid img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.article-sidebar {
  position: sticky;
  top: 1rem;
  align-self: start;
  display: grid;
  gap: 1rem;
}

.side-panel {
  border: 1px solid #e5e5e5;
  background: #ffffff;
  padding: 1rem;
}

.side-panel dl {
  display: grid;
  gap: 0.85rem;
  margin: 0;
}

.side-panel dt {
  color: #737373;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.side-panel dd {
  margin: 0.15rem 0 0;
  color: #111111;
  font-size: 0.9rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.tag-list span {
  border: 1px solid #d4d4d4;
  border-radius: 999px;
  color: #303030;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 0.35rem 0.65rem;
}

@media (max-width: 899.98px) {
  .article-layout {
    grid-template-columns: 1fr;
  }

  .article-sidebar {
    position: static;
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 639.98px) {
  .article-sidebar,
  .gallery-grid {
    grid-template-columns: 1fr;
  }
}
</style>
