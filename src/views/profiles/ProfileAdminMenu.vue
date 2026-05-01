<script setup>
import { defineProps } from 'vue'

const props = defineProps({
  profileId: {
    type: String,
    required: true
  },
  backRoute: {
    type: String,
    default: '/profiles'
  }
})
</script>

<template>
  <div class="d-flex align-items-center justify-content-center gap-3 mb-4">
    <!-- Botón Volver -->
    <router-link
      :to="backRoute"
      class="btn-back-circular shadow-sm"
      title="Volver"
    >
      <i class="bi bi-arrow-left"></i>
    </router-link>

    <!-- Menú de Navegación -->
    <div class="admin-menu-container">
      <ul class="nav nav-tabs border-0 gap-1">
        <li class="nav-item">
          <router-link
            :to="`/profiles/edit/${profileId}`"
            class="nav-link-admin"
            active-class="active"
          >
            <i class="bi bi-pencil me-2"></i>Editar
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.nav-link-admin {
  color: #6c757d;
  font-weight: 500;
  padding: 0.6rem 1.2rem;
  border-radius: 0.5em !important;
  text-decoration: none;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  border: 1px solid transparent;
  font-size: 0.9rem;
}

.nav-link-admin:hover {
  background-color: #f8f9fa;
  color: #000;
}

.nav-link-admin.active {
  background-color: #212529 !important;
  color: #fff !important;
  border-color: #212529 !important;
}

.btn-back-circular {
  width: 42px;
  height: 42px;
  background-color: white;
  border: 1px solid rgba(0,0,0,0.05);
  border-radius: 50% !important;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #212529;
  text-decoration: none;
  transition: all 0.2s;
  font-size: 1.2rem;
}

.btn-back-circular:hover {
  background-color: #212529;
  color: white;
  transform: translateX(-3px);
}

.admin-menu-container {
  background: white;
  padding: 0.5rem;
  border-radius: 0.75em;
  border: 1px solid rgba(0,0,0,0.05);
  display: inline-block;
}
</style>
