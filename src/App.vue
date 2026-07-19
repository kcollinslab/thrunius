<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import { withTimeout } from './lib/asyncTimeout'
import Sidebar from './components/navigation/Sidebar.vue'

const router = useRouter()
const route = useRoute()
const isSidebarOpen = ref(false)
const isMobileSidebar = ref(false)
const connectionStatus = ref(hasSupabaseConfig ? 'Verificando conexion...' : 'Falta configurar Supabase')
const currentUser = ref(null)
const AUTH_TIMEOUT_MS = 10000
let authSubscription
let sidebarMediaQuery

const statusClass = computed(() =>
  hasSupabaseConfig && supabase ? 'text-bg-success' : 'text-bg-secondary',
)

const mainLayoutStyle = computed(() => ({
  '--sidebar-offset': isMobileSidebar.value
    ? '0px'
    : isSidebarOpen.value
      ? '260px'
      : '72px',
}))

onMounted(async () => {
  sidebarMediaQuery = window.matchMedia('(max-width: 768px)')
  syncSidebarMode(sidebarMediaQuery)
  sidebarMediaQuery.addEventListener('change', syncSidebarMode)

  if (!supabase) return

  try {
    const { data: { session }, error } = await withTimeout(
      supabase.auth.getSession(),
      {
        timeout: AUTH_TIMEOUT_MS,
        message: 'No se pudo validar la sesión a tiempo.',
      },
    )
    if (error) throw error

    connectionStatus.value = 'Supabase conectado'
    if (session?.user) {
      mergeAuthUser(session.user)
      await fetchUserData(session.user)
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (nextSession?.user) {
        mergeAuthUser(nextSession.user)
        void fetchUserData(nextSession.user)
      } else {
        currentUser.value = null
      }
    })
    authSubscription = authListener.subscription
  } catch (error) {
    console.error('Error in App.vue onMounted:', error)
    connectionStatus.value = 'Revision pendiente'
  }
})

watch(
  () => route.fullPath,
  () => {
    closeMobileSidebar()
  },
)

function syncSidebarMode(event) {
  isMobileSidebar.value = event.matches

  if (event.matches) {
    isSidebarOpen.value = false
  }
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeMobileSidebar() {
  if (isMobileSidebar.value) {
    isSidebarOpen.value = false
  }
}

function getAuthUserData(user) {
  const { role: _supabaseAuthRole, ...authUserData } = user
  return authUserData
}

function mergeAuthUser(user) {
  const existingUser = currentUser.value?.id === user.id ? currentUser.value : {}

  currentUser.value = {
    ...existingUser,
    ...getAuthUserData(user),
  }
}

async function fetchUserData(user) {
  try {
    const abortController = new AbortController()
    const { data: profile, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .abortSignal(abortController.signal),
      {
        timeout: AUTH_TIMEOUT_MS,
        message: 'No se pudo cargar el perfil a tiempo.',
        onTimeout: () => abortController.abort(),
      },
    )

    if (error) {
      console.warn('Error fetching profile for user:', user.id, error.message)
    }

    const existingUser = currentUser.value?.id === user.id ? currentUser.value : {}

    currentUser.value = {
      ...existingUser,
      ...getAuthUserData(user),
      ...(profile || {}),
    }
  } catch (err) {
    console.error('Critical error in fetchUserData:', err)
  }
}

async function handleLogout() {
  await supabase.auth.signOut()
  isSidebarOpen.value = false
  router.push('/login')
}

onUnmounted(() => {
  authSubscription?.unsubscribe()
  sidebarMediaQuery?.removeEventListener('change', syncSidebarMode)
})
</script>

<template>
  <v-app>
    <button
      v-if="isMobileSidebar && !isSidebarOpen"
      type="button"
      class="mobile-sidebar-trigger"
      aria-label="Abrir menu"
      @click="toggleSidebar"
    >
      <i class="bi bi-list"></i>
    </button>

    <button
      v-if="isMobileSidebar && isSidebarOpen"
      type="button"
      class="sidebar-scrim"
      aria-label="Cerrar menu"
      @click="closeMobileSidebar"
    ></button>

    <Sidebar
      :is-open="isSidebarOpen"
      :is-mobile="isMobileSidebar"
      :user="currentUser"
      @toggle="toggleSidebar"
      @navigate="closeMobileSidebar"
      @logout="handleLogout"
    />

    <v-main :style="mainLayoutStyle" class="main-page-wrapper">
      <router-view :key="$route.fullPath"></router-view>
    </v-main>
  </v-app>
</template>

<style>
.fw-black { font-weight: 900; }

.v-application__wrap {
  min-height: 100vh !important;
}

.main-page-wrapper {
  padding-left: var(--sidebar-offset) !important;
  transition: padding-left 0.3s ease;
  min-height: 100vh;
  background-color: #fcfcfc;
}

.mobile-sidebar-trigger {
  position: fixed;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 10000;
  width: 44px;
  height: 44px;
  border: 1px solid #e5e7eb;
  border-radius: 0.5em;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}

.sidebar-scrim {
  position: fixed;
  inset: 0;
  z-index: 9998;
  border: 0;
  background: rgba(15, 23, 42, 0.35);
  padding: 0;
}

.home-card {
  background: white;
  border-radius: 0.5em;
  border: 1px solid rgba(0,0,0,0.05);
}

@media (max-width: 768px) {
  .main-page-wrapper {
    padding-left: 0 !important;
    padding-top: 4rem;
  }
}
</style>
