<script setup>
import { computed, onMounted, ref } from 'vue'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'

const articles = ref([])
const loading = ref(true)
const loadError = ref('')
const currentTopic = ref('todos')

const ARTICLE_LIMIT = 24
const PUBLIC_VISIBILITY = 'Público'

const featuredArticle = computed(() => articles.value[0] || null)
const secondaryArticles = computed(() => articles.value.slice(1, 4))
const latestArticles = computed(() => articles.value.slice(4))

const topics = computed(() => {
  const allTags = articles.value
    .flatMap((article) => normalizeTags(article.tags))
    .map((tag) => tag.trim())
    .filter(Boolean)

  return ['todos', ...Array.from(new Set(allTags)).slice(0, 8)]
})

const filteredLatestArticles = computed(() => {
  if (currentTopic.value === 'todos') return latestArticles.value

  return latestArticles.value.filter((article) =>
    normalizeTags(article.tags).includes(currentTopic.value),
  )
})

async function fetchArticles() {
  loading.value = true
  loadError.value = ''

  if (!hasSupabaseConfig || !supabase) {
    loadError.value = 'Supabase no está configurado en esta aplicación.'
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
        created_at
      `)
      .eq('type_post', 'noticia')
      .eq('visibility', PUBLIC_VISIBILITY)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(ARTICLE_LIMIT)

    if (error) throw error

    const posts = data || []
    const imageMap = await fetchArticleImages(posts.map((post) => post.id))

    articles.value = posts.map((post) => ({
      ...post,
      image: imageMap.get(post.id) || null,
    }))
  } catch (error) {
    console.error('Error al cargar artículos:', error)
    loadError.value = 'No se pudieron cargar los artículos. Intenta nuevamente.'
  } finally {
    loading.value = false
  }
}

async function fetchArticleImages(postIds) {
  const imageMap = new Map()
  if (!postIds.length) return imageMap

  try {
    const { data, error } = await supabase
      .from('files')
      .select(`
        id,
        post_id,
        bucket_id,
        storage_path,
        thumbnail_path,
        title,
        alt_text,
        is_main,
        created_at
      `)
      .in('post_id', postIds)
      .eq('is_image', true)
      .order('is_main', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) throw error

    for (const file of data || []) {
      if (!file.post_id || imageMap.has(file.post_id)) continue

      const storagePath = file.thumbnail_path || file.storage_path
      if (!storagePath) continue

      imageMap.set(file.post_id, {
        url: supabase.storage
          .from(file.bucket_id || 'media')
          .getPublicUrl(storagePath).data.publicUrl,
        alt: file.alt_text || file.title || '',
      })
    }
  } catch (error) {
    console.warn('No se pudieron cargar imágenes de artículos:', error)
  }

  return imageMap
}

function normalizeTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.filter(Boolean)

  return String(tags)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function getArticleSummary(article, maxLength = 180) {
  const source = article.excerpt || article.subtitle || stripHtml(article.content)
  const text = String(source || '').trim()

  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trim()}...`
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ')
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

function getReadingTime(article) {
  const words = stripHtml(`${article.title || ''} ${article.excerpt || ''} ${article.content || ''}`)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length

  return `${Math.max(1, Math.ceil(words / 220))} min`
}

function getTopicLabel(topic) {
  return topic === 'todos' ? 'Todos' : topic
}

function getArticleRoute(article) {
  return {
    name: 'article-read',
    params: { slug: article.slug },
  }
}

onMounted(fetchArticles)
</script>

<template>
  <main class="articles-explore">
    <section class="news-header">
      <div class="news-shell">
        <p class="news-kicker">Actualidad</p>
        <div class="news-title-row">
          <div>
            <h1>Artículos y noticias</h1>
            <p>
              Una portada editorial con las historias recientes de Thrunius, novedades y contenidos de interés.
            </p>
          </div>

          <button type="button" class="refresh-button" :disabled="loading" @click="fetchArticles">
            <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
            Actualizar
          </button>
        </div>
      </div>
    </section>

    <section class="news-shell news-body" aria-live="polite">
      <div v-if="loading" class="news-state">
        <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <span>Cargando artículos...</span>
      </div>

      <div v-else-if="loadError" class="news-state news-state-error" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        <span>{{ loadError }}</span>
        <button type="button" class="refresh-button" @click="fetchArticles">Reintentar</button>
      </div>

      <div v-else-if="!articles.length" class="news-state">
        <i class="bi bi-newspaper" aria-hidden="true"></i>
        <span>No hay noticias públicas disponibles por ahora.</span>
      </div>

      <template v-else>
        <section class="lead-grid" aria-label="Noticias destacadas">
          <RouterLink v-if="featuredArticle" :to="getArticleRoute(featuredArticle)" class="lead-story story-link">
            <div class="story-media story-media-large">
              <img
                v-if="featuredArticle.image?.url"
                :src="featuredArticle.image.url"
                :alt="featuredArticle.image.alt || featuredArticle.title"
                loading="eager"
              >
              <div v-else class="story-placeholder">
                <i class="bi bi-newspaper" aria-hidden="true"></i>
              </div>
            </div>

            <div class="lead-copy">
              <span class="section-label">Portada</span>
              <h2>{{ featuredArticle.title || 'Noticia sin título' }}</h2>
              <p>{{ getArticleSummary(featuredArticle, 240) }}</p>
              <div class="story-meta">
                <span>{{ formatDate(featuredArticle.published_at || featuredArticle.created_at) }}</span>
                <span>{{ getReadingTime(featuredArticle) }}</span>
              </div>
            </div>
          </RouterLink>

          <div class="side-stories">
            <RouterLink
              v-for="article in secondaryArticles"
              :key="article.id"
              :to="getArticleRoute(article)"
              class="side-story story-link"
            >
              <div class="story-media story-media-small">
                <img
                  v-if="article.image?.url"
                  :src="article.image.url"
                  :alt="article.image.alt || article.title"
                  loading="lazy"
                >
                <div v-else class="story-placeholder">
                  <i class="bi bi-card-text" aria-hidden="true"></i>
                </div>
              </div>

              <div>
                <span class="section-label">Actualidad</span>
                <h3>{{ article.title || 'Noticia sin título' }}</h3>
                <p>{{ getArticleSummary(article, 110) }}</p>
                <div class="story-meta">
                  <span>{{ formatDate(article.published_at || article.created_at) }}</span>
                </div>
              </div>
            </RouterLink>
          </div>
        </section>

        <nav v-if="topics.length > 1" class="topic-bar" aria-label="Filtrar artículos por tema">
          <button
            v-for="topic in topics"
            :key="topic"
            type="button"
            class="topic-button"
            :class="{ 'is-active': currentTopic === topic }"
            @click="currentTopic = topic"
          >
            {{ getTopicLabel(topic) }}
          </button>
        </nav>

        <section class="latest-section" aria-label="Más artículos">
          <div class="section-heading">
            <h2>Más recientes</h2>
            <span>{{ filteredLatestArticles.length }} artículos</span>
          </div>

          <div v-if="filteredLatestArticles.length" class="article-grid">
            <RouterLink
              v-for="article in filteredLatestArticles"
              :key="article.id"
              :to="getArticleRoute(article)"
              class="article-card story-link"
            >
              <div class="story-media card-media">
                <img
                  v-if="article.image?.url"
                  :src="article.image.url"
                  :alt="article.image.alt || article.title"
                  loading="lazy"
                >
                <div v-else class="story-placeholder">
                  <i class="bi bi-journal-text" aria-hidden="true"></i>
                </div>
              </div>

              <div class="article-card-body">
                <div class="story-meta">
                  <span>{{ formatDate(article.published_at || article.created_at) }}</span>
                  <span>{{ getReadingTime(article) }}</span>
                </div>
                <h3>{{ article.title || 'Noticia sin título' }}</h3>
                <p>{{ getArticleSummary(article, 145) }}</p>
                <div v-if="normalizeTags(article.tags).length" class="tag-list">
                  <span v-for="tag in normalizeTags(article.tags).slice(0, 3)" :key="tag">#{{ tag }}</span>
                </div>
              </div>
            </RouterLink>
          </div>

          <div v-else class="news-state">
            <span>No hay artículos para este tema.</span>
          </div>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
.articles-explore {
  min-height: 100vh;
  background: #f7f7f7;
  color: #111111;
}

.news-shell {
  width: min(100%, 1180px);
  margin: 0 auto;
  padding-inline: clamp(1rem, 3vw, 2rem);
}

.news-header {
  border-bottom: 1px solid #e5e5e5;
  background: #ffffff;
}

.news-header .news-shell {
  padding-top: clamp(2rem, 5vw, 4.5rem);
  padding-bottom: 1.5rem;
}

.news-kicker,
.section-label {
  margin: 0;
  color: #525252;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.news-title-row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
}

.news-title-row h1 {
  margin: 0.25rem 0 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: clamp(2rem, 5.5vw, 4.25rem);
  font-weight: 850;
  letter-spacing: 0;
  line-height: 1;
}

.news-title-row p {
  max-width: 640px;
  margin: 1rem 0 0;
  color: #525252;
  font-size: 1rem;
  line-height: 1.65;
}

.refresh-button {
  display: inline-flex;
  min-height: 2.6rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid #111111;
  border-radius: 0.35rem;
  background: #111111;
  color: #ffffff;
  font-size: 0.84rem;
  font-weight: 700;
  padding: 0.6rem 0.9rem;
  white-space: nowrap;
}

.refresh-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.news-body {
  padding-top: 1.5rem;
  padding-bottom: clamp(2rem, 5vw, 4rem);
}

.news-state {
  display: flex;
  min-height: 18rem;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  border: 1px solid #e5e5e5;
  background: #ffffff;
  color: #525252;
  text-align: center;
}

.news-state-error {
  flex-wrap: wrap;
  color: #111111;
}

.lead-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
}

.lead-story,
.side-story,
.article-card {
  border: 1px solid #e5e5e5;
  background: #ffffff;
}

.story-link {
  color: inherit;
  text-decoration: none;
}

.story-link:hover h2,
.story-link:hover h3 {
  text-decoration: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.12em;
}

.lead-story {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  min-height: 34rem;
}

.story-media {
  position: relative;
  overflow: hidden;
  background: #e5e5e5;
}

.story-media img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.story-media-large {
  min-height: 34rem;
}

.story-media-small {
  width: 8rem;
  min-height: 8rem;
  flex: 0 0 8rem;
}

.story-placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: inherit;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(135deg, rgba(17, 17, 17, 0.08), transparent 36%),
    repeating-linear-gradient(0deg, #ededed, #ededed 1px, #fafafa 1px, #fafafa 9px);
  color: #111111;
  font-size: 2rem;
}

.lead-copy {
  display: flex;
  flex-direction: column;
  justify-content: end;
  padding: clamp(1.25rem, 3vw, 2rem);
}

.lead-copy h2,
.side-story h3,
.article-card h3,
.section-heading h2 {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0;
}

.lead-copy h2 {
  margin: 0.75rem 0 1rem;
  font-size: clamp(1.75rem, 3.4vw, 2.8rem);
  font-weight: 800;
  line-height: 1.08;
}

.lead-copy p,
.side-story p,
.article-card p {
  color: #525252;
  line-height: 1.6;
}

.lead-copy p {
  font-size: 1.02rem;
}

.story-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  color: #737373;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
}

.story-meta span + span::before {
  content: '•';
  margin-right: 0.8rem;
  color: #b3b3b3;
}

.side-stories {
  display: grid;
  gap: 1rem;
}

.side-story {
  display: flex;
  min-height: 10rem;
}

.side-story > div:last-child {
  min-width: 0;
  padding: 1rem;
}

.side-story h3 {
  margin: 0.45rem 0 0.45rem;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.18;
}

.side-story p {
  margin-bottom: 0.75rem;
  font-size: 0.86rem;
}

.topic-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1.25rem 0;
  padding: 0.75rem 0;
  border-top: 1px solid #e5e5e5;
  border-bottom: 1px solid #e5e5e5;
}

.topic-button {
  border: 1px solid #d4d4d4;
  border-radius: 999px;
  background: #ffffff;
  color: #404040;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.45rem 0.85rem;
}

.topic-button.is-active,
.topic-button:hover {
  border-color: #111111;
  background: #111111;
  color: #ffffff;
}

.latest-section {
  margin-top: 1.25rem;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.section-heading h2 {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 850;
}

.section-heading span {
  color: #737373;
  font-size: 0.82rem;
  font-weight: 700;
}

.article-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.article-card {
  min-width: 0;
}

.card-media {
  aspect-ratio: 16 / 10;
}

.article-card-body {
  padding: 1rem;
}

.article-card h3 {
  margin: 0.7rem 0 0.5rem;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.18;
}

.article-card p {
  margin-bottom: 0.9rem;
  font-size: 0.9rem;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: #303030;
  font-size: 0.76rem;
  font-weight: 700;
}

@media (max-width: 1099.98px) {
  .lead-grid,
  .lead-story {
    grid-template-columns: 1fr;
  }

  .lead-story,
  .story-media-large {
    min-height: auto;
  }

  .story-media-large {
    aspect-ratio: 16 / 9;
  }

  .side-stories {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .side-story {
    display: block;
  }

  .story-media-small {
    width: 100%;
    aspect-ratio: 16 / 10;
  }
}

@media (max-width: 899.98px) {
  .news-title-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .article-grid,
  .side-stories {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 639.98px) {
  .article-grid,
  .side-stories {
    grid-template-columns: 1fr;
  }

  .side-story {
    display: flex;
  }

  .story-media-small {
    width: 7rem;
    min-height: 7rem;
    flex-basis: 7rem;
    aspect-ratio: auto;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 459.98px) {
  .side-story {
    display: block;
  }

  .story-media-small {
    width: 100%;
    aspect-ratio: 16 / 10;
  }
}
</style>
