<script setup>
defineProps({
  backLink: {
    type: String,
    required: true,
  },
  menuItems: {
    type: Array,
    required: true,
  },
})
</script>

<template>
  <div class="nav-tabs-wrapper d-flex align-items-center justify-content-start gap-3">
    <div class="nav-tabs-container">
      <ul class="nav nav-tabs">
        <li class="nav-item">
          <router-link class="nav-link" :to="backLink" title="Volver">
            <i class="bi bi-arrow-left"></i>
          </router-link>
        </li>
        <li v-for="item in menuItems" :key="item.to" class="nav-item">
          <router-link
            :to="item.to"
            class="nav-link"
            active-class="active"
          >
            <i v-if="item.icon" :class="[item.icon, 'me-2']"></i>{{ item.label }}
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.nav-tabs-container {
  padding: 0;
  border-radius: 0.5em;
  display: inline-block;
}

.nav-tabs-wrapper {
  position: relative;
  z-index: 3;
}

.nav-tabs {
  border-bottom-color: #dee2e6;
}

.nav-tabs .nav-link {
  color: #000;
  font-size: 0.85rem;
  padding: 0.35rem 0.75rem;
}

.nav-tabs .nav-link i {
  color: inherit;
}

.nav-tabs .nav-link:hover {
  background-color: transparent;
  border-color: transparent transparent #000;
  border-bottom-width: 2px;
  color: #000;
}

.nav-tabs .nav-link.active {
  background-color: transparent;
  border-color: transparent transparent #000;
  border-bottom-width: 2px;
  color: #000;
  font-weight: 700;
}
</style>
