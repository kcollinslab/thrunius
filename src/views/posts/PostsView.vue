<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase'
import PostAdminMenu from './PostAdminMenu.vue'

const route = useRoute()
const postTitle = ref('')

const showAdminMenu = computed(() => (
  Boolean(route.params.id) && ['edit-post', 'edit-post-content', 'preview-post', 'images-post'].includes(route.name)
))

const adminHeaderTitle = computed(() => postTitle.value.trim() || '(Sin nombre)')

watch(
  () => route.params.id,
  async (postId) => {
    postTitle.value = ''

    if (!postId || !showAdminMenu.value) return

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('title')
        .eq('id', postId)
        .single()

      if (error) throw error

      postTitle.value = data?.title || ''
    } catch (error) {
      console.error('Error fetching post title:', error)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="posts-view-container py-3">
    <section v-if="showAdminMenu" class="post-admin-shell container-fluid">
      <div class="post-admin-bar d-flex flex-column align-items-start gap-2">
        <h2 class="post-title mb-1">{{ adminHeaderTitle }}</h2>

        <PostAdminMenu :post-id="route.params.id" />
      </div>
    </section>

    <router-view />
  </div>
</template>

<style scoped>
.posts-view-container {
  min-height: 100%;
}

.post-admin-shell {
  position: relative;
  z-index: 2;
}

.post-admin-bar {
  border-radius: 0.75em;
}

.post-title{
  font-size: 1.25rem;
  font-weight: 500;
  color: #6c757d;
}
</style>
