<script setup>
import { computed } from 'vue'
import NavTabs1 from '../../components/navigation/NavTabs1.vue'

const props = defineProps({
  postId: {
    type: String,
    required: true,
  },
  backRoute: {
    type: String,
    default: '/posts',
  },
})

const menuItems = computed(() => [
  {
    label: 'Vista previa',
    to: `/posts/preview/${props.postId}`,
    icon: 'bi bi-eye',
  },
  {
    label: 'Editar',
    to: `/posts/edit/${props.postId}`,
    icon: 'bi bi-pencil',
  },
  {
    label: 'Imágenes',
    to: `/posts/images/${props.postId}`,
    icon: 'bi bi-images',
  },
])
</script>

<template>
  <NavTabs1 :back-link="backRoute" :menu-items="menuItems" />
</template>
