<script setup>
import { useRoute } from 'vue-router'
import ProfileAdminMenu from './ProfileAdminMenu.vue'

const route = useRoute()
</script>

<template>
  <div class="profiles-view-container">
    <!-- Menú administrativo solo si hay un ID de perfil en la ruta -->
    <div v-if="route.params.id && (route.name === 'edit-profile')" class="text-center pt-3">
      <ProfileAdminMenu :profile-id="route.params.id" />
    </div>

    <router-view />
  </div>
</template>

<style scoped>
.profiles-view-container {
  min-height: 100%;
}
</style>
