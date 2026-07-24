<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// Props que controlan el estado visual y la información del usuario.
const props = defineProps({
  isOpen: Boolean,
  isMobile: Boolean,
  user: Object,
})

// Eventos que el sidebar comunica a su componente padre.
const emit = defineEmits(['toggle', 'logout', 'navigate'])

// Ruta actual para identificar la sección activa del menú.
const route = useRoute()

// Opción pública de inicio, visible con o sin sesión iniciada.
const HOME_MENU_ITEM = {
  path: '/articulos',
  label: 'Inicio',
  icon: 'bi-house',
}

// Opciones de navegación disponibles según el rol del usuario.
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
    roles: ['admin', 'editor'],
  },
  {
    path: '/profiles',
    label: 'Administración',
    icon: 'bi-shield-lock',
    roles: ['admin'],
  },
  {
    path: '/profile',
    label: 'Mi perfil',
    icon: 'bi-person-circle',
    roles: ['admin', 'editor', 'subscriber'],
  },
]

// Equivalencias para aceptar nombres alternativos de roles.
const ROLE_ALIASES = {
  administrator: 'admin',
  administrador: 'admin',
  administradora: 'admin',
  suscriptor: 'subscriber',
  suscriptora: 'subscriber',
}

// Roles permitidos por las opciones configuradas del menú.
const KNOWN_MENU_ROLES = new Set(ALL_MENU_ITEMS.flatMap((item) => item.roles))

// Texto visible asociado a cada rol reconocido.
const ROLE_LABELS = {
  admin: 'Administrador',
  editor: 'Editor',
  subscriber: 'Suscriptor',
}

// Menú filtrado según el rol normalizado del usuario actual.
const menuItems = computed(() => {
  if (!props.user) return [HOME_MENU_ITEM]

  const userRole = normalizeUserRole(props.user)

  return [
    HOME_MENU_ITEM,
    ...ALL_MENU_ITEMS.filter((item) => item.roles.includes(userRole)),
  ]
})

// Nombre que se muestra usando las fuentes disponibles del usuario.
const userDisplayName = computed(() => (
  props.user?.full_name
  || props.user?.name
  || props.user?.user_metadata?.full_name
  || props.user?.email?.split('@')[0]
  || 'Usuario'
))

// Etiqueta legible del rol actual del usuario.
const userRoleLabel = computed(() => ROLE_LABELS[normalizeUserRole(props.user)] || 'Usuario')

// Iniciales del usuario para mostrar en su avatar.
const userInitials = computed(() => {
  const initials = userDisplayName.value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')

  return initials.toUpperCase() || 'U'
})

// Obtiene y valida el rol del usuario, incluyendo alias conocidos.
function normalizeUserRole(user) {
  const roleCandidates = [
    user?.role,
    user?.app_metadata?.role,
  ]

  for (const rawRole of roleCandidates) {
    if (!rawRole) continue

    const normalizedRole = String(rawRole).trim().toLowerCase()
    const mappedRole = ROLE_ALIASES[normalizedRole] || normalizedRole

    if (KNOWN_MENU_ROLES.has(mappedRole)) return mappedRole
  }

  return 'subscriber'
}

// Indica si una ruta corresponde a la sección activa del menú.
function isMenuItemActive(path) {
  return path === '/'
    ? route.path === '/'
    : route.path === path || route.path.startsWith(`${path}/`)
}

// Solicita al componente padre alternar la apertura del sidebar.
function toggleSidebar() {
  emit('toggle')
}

// Notifica al componente padre que se seleccionó una navegación.
function handleNavigate() {
  emit('navigate')
}

// Notifica al componente padre que se solicitó cerrar sesión.
function handleLogout() {
  emit('logout')
}
</script>

<template>
  <aside
    class="sidebar-panel"
    :class="{ 'is-open': isOpen, 'is-mobile': isMobile }"
    aria-label="Menú principal"
  >
    <div class="sidebar-header">
      <div class="sidebar-brand">
        <div class="logo-mark" aria-hidden="true">
          T
        </div>
        <Transition name="fade-slide">
          <span v-if="isOpen" class="logo-text">Thrunius</span>
        </Transition>
      </div>
      <button
        class="toggle-btn"
        type="button"
        @click="toggleSidebar"
        :aria-expanded="isOpen"
        :aria-label="isOpen ? 'Colapsar menú' : 'Expandir menú'"
        :title="isOpen ? 'Colapsar menú' : 'Expandir menú'"
      >
        <i class="bi" :class="isOpen ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar'" aria-hidden="true"></i>
      </button>
    </div>

    <div class="sidebar-body">
      <Transition name="fade-slide">
        <p v-if="isOpen" class="sidebar-nav-label">Navegación</p>
      </Transition>

      <nav class="sidebar-nav">
        <template v-if="!user">
          <router-link
            :to="HOME_MENU_ITEM.path"
            class="nav-link-custom"
            :class="{ 'is-section-active': isMenuItemActive(HOME_MENU_ITEM.path) }"
            :title="!isOpen ? HOME_MENU_ITEM.label : ''"
            @click="handleNavigate"
          >
            <i class="bi" :class="HOME_MENU_ITEM.icon" aria-hidden="true"></i>
            <Transition name="fade-slide">
              <span v-if="isOpen">{{ HOME_MENU_ITEM.label }}</span>
            </Transition>
          </router-link>
          <router-link
            to="/login"
            class="nav-link-custom"
            :title="!isOpen ? 'Iniciar sesión' : ''"
            @click="handleNavigate"
          >
            <i class="bi bi-box-arrow-in-right" aria-hidden="true"></i>
            <Transition name="fade-slide">
              <span v-if="isOpen">Iniciar sesión</span>
            </Transition>
          </router-link>
          <router-link
            to="/register"
            class="nav-link-custom"
            :title="!isOpen ? 'Registrarse' : ''"
            @click="handleNavigate"
          >
            <i class="bi bi-person-plus" aria-hidden="true"></i>
            <Transition name="fade-slide">
              <span v-if="isOpen">Registrarse</span>
            </Transition>
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
            <i class="bi" :class="item.icon" aria-hidden="true"></i>
            <Transition name="fade-slide">
              <span v-if="isOpen">{{ item.label }}</span>
            </Transition>
          </router-link>
        </template>
      </nav>
    </div>

    <div v-if="user" class="sidebar-footer">
      <div class="sidebar-user" :title="!isOpen ? userDisplayName : ''">
        <span class="user-avatar" aria-hidden="true">{{ userInitials }}</span>
        <Transition name="fade-slide">
          <span v-if="isOpen" class="user-details">
            <strong>{{ userDisplayName }}</strong>
            <small>{{ userRoleLabel }}</small>
          </span>
        </Transition>
      </div>

      <button
        type="button"
        class="btn-logout-custom"
        :title="!isOpen ? 'Cerrar sesión' : ''"
        @click="handleLogout"
      >
        <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
        <Transition name="fade-slide">
          <span v-if="isOpen">Cerrar sesión</span>
        </Transition>
      </button>
    </div>
  </aside>
</template>

<style scoped>
/* Base Panel */
.sidebar-panel {
  --sidebar-radius: 0.4em;
  width: 72px;
  height: 100vh;
  height: 100dvh;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  z-index: 9999;
  transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1), transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  overflow-x: hidden;
  border-right: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 8px 0 32px rgba(15, 23, 42, 0.04);
}

.sidebar-panel.is-open {
  width: 260px;
}

/* Sidebar Body - Spacing */
.sidebar-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.5rem;
  scrollbar-color: #d8dce2 transparent;
  scrollbar-width: thin;
}

.sidebar-header {
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.sidebar-brand {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 0.65rem;
  overflow: hidden;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sidebar-nav-label {
  margin: 0.75rem 0.75rem 0.6rem;
  color: #9aa0a9;
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

/* Collapsed Header & Layout */
.sidebar-panel:not(.is-open) .sidebar-header {
  justify-content: center;
  padding: 0.75rem 0.5rem;
}

.sidebar-panel:not(.is-open) .sidebar-brand {
  display: none;
}

.sidebar-panel:not(.is-open) .toggle-btn {
  width: 44px;
  height: 44px;
}

/* Perfect Square & Centered Items when Collapsed */
.sidebar-panel:not(.is-open) .nav-link-custom {
  width: 48px;
  height: 48px;
  justify-content: center;
  margin: 0 auto;
  padding: 0;
  border-radius: var(--sidebar-radius);
}

/* Perfect Square Logout Button when Collapsed */
.sidebar-panel:not(.is-open) .btn-logout-custom {
  width: 48px;
  height: 48px;
  justify-content: center;
  margin: 0 auto;
  padding: 0;
  border-radius: var(--sidebar-radius);
}

.sidebar-panel:not(.is-open) .sidebar-user {
  width: 48px;
  height: 48px;
  justify-content: center;
  margin: 0 auto;
  padding: 0;
}

/* Branding */
.logo-mark {
  display: inline-flex;
  width: 36px;
  height: 36px;
  min-width: 36px;
  align-items: center;
  justify-content: center;
  border-radius: var(--sidebar-radius);
  background: #17191c;
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.14);
}

.logo-text {
  overflow: hidden;
  color: #17191c;
  font-size: 1rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Toggle Button */
.toggle-btn {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: var(--sidebar-radius);
  background: transparent;
  color: #68707b;
  transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}

.toggle-btn:hover {
  border-color: rgba(15, 23, 42, 0.12);
  background-color: #f2f3f5;
  color: #17191c;
}

/* Navigation Links */
.nav-link-custom {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid transparent;
  border-radius: var(--sidebar-radius);
  color: #606873;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

/* Bulletproof Icon centering and bounding box to prevent clipping on hover */
.nav-link-custom i {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.1rem;
  transition: transform 0.18s ease;
}

.nav-link-custom:hover {
  border-color: rgba(15, 23, 42, 0.05);
  background: #f3f4f6;
  color: #17191c;
}

.sidebar-panel.is-open .nav-link-custom:hover {
  transform: translateX(2px);
}

.sidebar-panel:not(.is-open) .nav-link-custom:hover {
  transform: translateY(-1px);
}

.nav-link-custom:hover i {
  transform: scale(1.05);
}

/* Active State */
.nav-link-custom.router-link-active,
.nav-link-custom.is-section-active {
  border-color: #17191c;
  background: #17191c;
  color: #ffffff;
  box-shadow: 0 9px 20px rgba(15, 23, 42, 0.14);
}

.nav-link-custom.router-link-active i,
.nav-link-custom.is-section-active i {
  color: #ffffff;
}

/* Footer & Logout Button */
.sidebar-footer {
  display: grid;
  gap: 0.5rem;
  margin-top: auto;
  padding: 0.75rem;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.sidebar-user {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem;
  border-radius: var(--sidebar-radius);
  background: #f5f6f7;
}

.user-avatar {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  border-radius: var(--sidebar-radius);
  background: #e4e7eb;
  color: #33383f;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.user-details {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 1.25;
}

.user-details strong,
.user-details small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-details strong {
  color: #292d32;
  font-size: 0.8rem;
  font-weight: 700;
}

.user-details small {
  margin-top: 0.15rem;
  color: #8a919a;
  font-size: 0.7rem;
}

.btn-logout-custom {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: var(--sidebar-radius);
  background-color: transparent;
  color: #68707b;
  font-size: 0.86rem;
  font-weight: 600;
  transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}

.btn-logout-custom:hover {
  border-color: rgba(220, 38, 38, 0.15);
  background-color: rgba(220, 38, 38, 0.05);
  color: #dc2626;
}

.btn-logout-custom i {
  display: inline-flex;
  width: 32px;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.05rem;
  transition: transform 0.18s ease;
}

.btn-logout-custom:hover i {
  transform: translateX(2px);
}

.toggle-btn:focus-visible,
.nav-link-custom:focus-visible,
.btn-logout-custom:focus-visible {
  outline: 2px solid #17191c;
  outline-offset: 2px;
}

/* Vue Transitions */
.fade-slide-enter-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) 0.1s;
}

.fade-slide-leave-active {
  transition: opacity 0.12s cubic-bezier(0.4, 0, 0.2, 1), transform 0.12s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* Responsive Overrides */
@media (max-width: 768px) {
  .sidebar-panel {
    width: min(280px, 86vw);
    max-width: 86vw;
    transform: translateX(-100%);
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 18px 0 48px rgba(15, 23, 42, 0.16);
  }

  .sidebar-panel.is-open {
    width: min(280px, 86vw);
    transform: translateX(0);
  }

  .sidebar-panel:not(.is-open) .sidebar-header {
    justify-content: space-between;
    padding: 0.875rem;
  }

  .sidebar-panel:not(.is-open) .sidebar-brand {
    display: flex;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-panel,
  .nav-link-custom,
  .btn-logout-custom,
  .fade-slide-enter-active,
  .fade-slide-leave-active {
    transition: none;
  }
}
</style>
