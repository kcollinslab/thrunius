<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  isOpen: Boolean,
  isMobile: Boolean,
  user: Object,
})

const emit = defineEmits(['toggle', 'logout', 'navigate'])
const route = useRoute()

const ALL_MENU_ITEMS = [
  {
    path: '/posts',
    label: 'Publicaciones',
    icon: 'bi-journal-text',
    roles: ['admin', 'editor'],
  },
  {
    path: '/files',
    label: 'Biblioteca',
    icon: 'bi-images',
    roles: ['admin', 'editor', 'subscriber'],
  },
  {
    path: '/profiles',
    label: 'Administracion',
    icon: 'bi-shield-lock',
    roles: ['admin'],
  },
  {
    path: '/profile',
    label: 'Mi Perfil',
    icon: 'bi-person-circle',
    roles: ['admin', 'editor', 'subscriber'],
  },
]

const ROLE_ALIASES = {
  administrator: 'admin',
  administrador: 'admin',
  administradora: 'admin',
  suscriptor: 'subscriber',
  suscriptora: 'subscriber',
}

const KNOWN_MENU_ROLES = new Set(ALL_MENU_ITEMS.flatMap((item) => item.roles))

const menuItems = computed(() => {
  if (!props.user) return []

  const userRole = normalizeUserRole(props.user)

  return ALL_MENU_ITEMS.filter((item) => item.roles.includes(userRole))
})

function normalizeUserRole(user) {
  const roleCandidates = [
    user?.role,
    user?.app_metadata?.role,
    user?.user_metadata?.role,
  ]

  for (const rawRole of roleCandidates) {
    if (!rawRole) continue

    const normalizedRole = String(rawRole).trim().toLowerCase()
    const mappedRole = ROLE_ALIASES[normalizedRole] || normalizedRole

    if (KNOWN_MENU_ROLES.has(mappedRole)) return mappedRole
  }

  return 'subscriber'
}

function isMenuItemActive(path) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function toggleSidebar() {
  emit('toggle')
}

function handleNavigate() {
  emit('navigate')
}

function handleLogout() {
  emit('logout')
}
</script>

<template>
  <aside
    class="sidebar-panel border-end shadow-sm"
    :class="{ 'is-open': isOpen, 'is-mobile': isMobile }"
    aria-label="Menu principal"
  >
    <div class="sidebar-header d-flex align-items-center p-3">
      <div class="sidebar-brand d-flex align-items-center gap-2 w-100 overflow-hidden">
        <div class="logo-circle bg-dark text-white d-flex align-items-center justify-content-center flex-shrink-0">
          <i class="bi bi-cpu-fill" aria-hidden="true"></i>
        </div>
        <span v-if="isOpen" class="fw-bold mb-0 text-nowrap logo-text">Thrunius</span>
      </div>
      <button
        class="btn btn-sm btn-light border-0 ms-auto toggle-btn"
        type="button"
        @click="toggleSidebar"
        :aria-expanded="isOpen"
        :aria-label="isOpen ? 'Colapsar menu' : 'Expandir menu'"
        :title="isOpen ? 'Colapsar menu' : 'Expandir menu'"
      >
        <i class="bi" :class="isOpen ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar'" aria-hidden="true"></i>
      </button>
    </div>

    <div class="sidebar-body p-2 mt-2 flex-grow-1 overflow-y-auto">
      <nav class="nav flex-column gap-2 w-100">
        <template v-if="!user">
          <router-link
            to="/login"
            class="nav-link-custom"
            :title="!isOpen ? 'Iniciar Sesion' : ''"
            @click="handleNavigate"
          >
            <i class="bi bi-box-arrow-in-right flex-shrink-0" aria-hidden="true"></i>
            <span v-if="isOpen" class="ms-3">Iniciar Sesion</span>
          </router-link>
          <router-link
            to="/register"
            class="nav-link-custom"
            :title="!isOpen ? 'Registrarse' : ''"
            @click="handleNavigate"
          >
            <i class="bi bi-person-plus flex-shrink-0" aria-hidden="true"></i>
            <span v-if="isOpen" class="ms-3">Registrarse</span>
          </router-link>
        </template>

        <template v-else>
          <router-link
            v-for="item in menuItems"
            :key="item.path"
            :to="item.path"
            class="nav-link-custom"
            :class="{ 'is-section-active': isMenuItemActive(item.path) }"
            :title="!isOpen ? item.label : ''"
            @click="handleNavigate"
          >
            <i class="bi flex-shrink-0" :class="item.icon" aria-hidden="true"></i>
            <span v-if="isOpen" class="ms-3">{{ item.label }}</span>
          </router-link>
        </template>
      </nav>
    </div>

    <div class="sidebar-footer p-2 border-top mt-auto bg-white">
      <button
        v-if="user"
        @click="handleLogout"
        type="button"
        class="btn btn-logout-custom w-100 d-flex align-items-center gap-2 mb-2"
        :class="{ 'justify-content-center': !isOpen }"
        :title="!isOpen ? 'Cerrar Sesion' : ''"
      >
        <i class="bi bi-box-arrow-right fs-5 flex-shrink-0" aria-hidden="true"></i>
        <span v-if="isOpen" class="text-nowrap ms-2">Cerrar Sesion</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-panel {
  width: 72px;
  height: 100vh;
  background: white;
  z-index: 9999;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  overflow-x: hidden;
  border-right: 1px solid #e5e7eb;
}

.sidebar-panel.is-open {
  width: 260px;
}

.sidebar-panel:not(.is-open) .sidebar-header {
  justify-content: center;
  padding: 0.75rem 0.5rem !important;
}

.sidebar-panel:not(.is-open) .sidebar-brand {
  display: none !important;
}

.sidebar-panel:not(.is-open) .toggle-btn {
  margin-left: 0 !important;
}

.logo-circle {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 0.5em;
  font-size: 1rem;
}

.logo-text {
  font-size: 1.1rem;
  letter-spacing: 0;
  color: #111;
}

.toggle-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5em;
  transition: background-color 0.2s;
}

.toggle-btn:hover {
  background-color: #f0f0f0;
}

.nav-link-custom {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border-radius: 0.5em;
  color: #4b5563;
  text-decoration: none;
  font-weight: 500;
  transition: background-color 0.2s, color 0.2s;
  min-height: 44px;
  white-space: nowrap;
  font-size: 0.95rem;
  user-select: none;
}

.nav-link-custom i {
  font-size: 1.1rem;
  width: 32px;
  display: flex;
  justify-content: center;
}

.nav-link-custom:hover {
  background: #f3f4f6;
  color: #111;
}

.nav-link-custom.router-link-active,
.nav-link-custom.is-section-active {
  background: #111827;
  color: white;
}

.nav-link-custom.router-link-active i,
.nav-link-custom.is-section-active i {
  color: white !important;
}

.btn-logout-custom {
  background-color: white;
  border: 1px solid #e5e7eb;
  padding: 0.5rem;
  border-radius: 0.5em;
  font-weight: 500;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
  min-height: 44px;
  font-size: 0.95rem;
  color: #4b5563;
}

.btn-logout-custom:hover {
  background-color: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

@media (max-width: 768px) {
  .sidebar-panel {
    width: min(280px, 86vw);
    max-width: 86vw;
    transform: translateX(-100%);
  }

  .sidebar-panel.is-open {
    width: min(280px, 86vw);
    transform: translateX(0);
  }

  .sidebar-panel:not(.is-open) .sidebar-header {
    justify-content: space-between;
    padding: 1rem !important;
  }

  .sidebar-panel:not(.is-open) .sidebar-brand {
    display: flex !important;
  }
}
</style>
