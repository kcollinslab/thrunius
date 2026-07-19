import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/auth/LoginView.vue'
import RegisterView from '../views/auth/RegisterView.vue'
import RecoveryPassword from '../views/auth/RecoveryPassword.vue'
import NewPassword from '../views/auth/NewPassword.vue'
import ProfileView from '../views/profile/ProfileView.vue'
import PostsView from '../views/posts/PostsView.vue'
import PostsListView from '../views/posts/PostsListView.vue'
import CreatePostView from '../views/posts/CreatePostView.vue'
import EditPostView from '../views/posts/EditPostView.vue'
import PostPreviewView from '../views/posts/PostPreviewView.vue'
import PostImagesView from '../views/posts/PostImagesView.vue'
import FilesListView from '../views/files/FilesListView.vue'
import FilesCreateView from '../views/files/FilesCreateView.vue'
import FilesEditView from '../views/files/FilesEditView.vue'
import MemoriaColores from '../views/games/MemoriaColores.vue'
import ProfilesView from '../views/profiles/ProfilesView.vue'
import ProfilesListView from '../views/profiles/ProfilesListView.vue'
import EditProfileView from '../views/profiles/EditProfileView.vue'
import { supabase } from '../lib/supabase'
import { withTimeout, isTimeoutError } from '../lib/asyncTimeout'

const APP_NAME = 'Thrunius'
const AUTH_CHECK_TIMEOUT_MS = 10000

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { title: 'Iniciar sesión', isPublic: true, authMethod: 'password' }
  },
  {
    path: '/login/link',
    name: 'login-link',
    component: LoginView,
    meta: { title: 'Iniciar sesión con magic link', isPublic: true, authMethod: 'magic-link' }
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: { title: 'Registrarse', isPublic: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: RecoveryPassword,
    meta: { title: 'Recuperar contraseña', isPublic: true }
  },
  {
    path: '/new-password',
    name: 'new-password',
    component: NewPassword,
    meta: { title: 'Nueva contraseña', isPublic: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { title: 'Mi perfil', requiresAuth: true }
  },
  {
    path: '/files',
    name: 'files',
    component: FilesListView,
    meta: { title: 'Archivos', requiresAuth: true }
  },
  {
    path: '/files/new',
    name: 'create-file',
    component: FilesCreateView,
    meta: { title: 'Nuevo archivo', requiresAuth: true }
  },
  {
    path: '/files/edit/:id',
    name: 'edit-file',
    component: FilesEditView,
    meta: { title: 'Editar archivo', requiresAuth: true }
  },
  {
    path: '/games/memoria-colores',
    name: 'memoria-colores',
    component: MemoriaColores,
    meta: { title: 'Memoria de colores', isPublic: true }
  },
  {
    path: '/posts',
    component: PostsView,
    children: [
      {
        path: '',
        name: 'posts',
        component: PostsListView,
        meta: { title: 'Posts', roles: ['admin', 'editor'] }
      },
      {
        path: 'new',
        name: 'create-post',
        component: CreatePostView,
        meta: { title: 'Nuevo post', roles: ['admin', 'editor'] }
      },
      {
        path: 'edit/:id',
        name: 'edit-post',
        component: EditPostView,
        meta: { title: 'Editar post', roles: ['admin', 'editor'] }
      },
      {
        path: 'preview/:id',
        name: 'preview-post',
        component: PostPreviewView,
        meta: { title: 'Vista previa', roles: ['admin', 'editor'] }
      },
      {
        path: 'images/:id',
        name: 'images-post',
        component: PostImagesView,
        meta: { title: 'Imágenes del post', roles: ['admin', 'editor'] }
      }
    ]
  },
  {
    path: '/profiles',
    component: ProfilesView,
    children: [
      {
        path: '',
        name: 'profiles',
        component: ProfilesListView,
        meta: { title: 'Usuarios', roles: ['admin'] }
      },
      {
        path: 'edit/:id',
        name: 'edit-profile',
        component: EditProfileView,
        meta: { title: 'Editar usuario', roles: ['admin'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase()
}

// Control de Acceso por Roles (Navigation Guard)
router.beforeEach(async (to) => {
  const requiresAuth = Boolean(to.meta?.requiresAuth || to.meta?.roles)
  const requiredRoles = to.meta?.roles
  let session = null

  if (!requiresAuth) {
    return true
  }

  if (!supabase) {
    return { name: 'login' }
  }

  try {
    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      {
        timeout: AUTH_CHECK_TIMEOUT_MS,
        message: 'No se pudo validar la sesión a tiempo.',
      },
    )

    if (error) throw error
    session = data?.session

    if (!session) {
      return { name: 'login' }
    }

    if (requiredRoles) {
      const abortController = new AbortController()
      const { data: profile, error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
          .abortSignal(abortController.signal),
        {
          timeout: AUTH_CHECK_TIMEOUT_MS,
          message: 'No se pudo validar el rol a tiempo.',
          onTimeout: () => abortController.abort(),
        },
      )

      if (profileError) throw profileError

      if (profile && requiredRoles.includes(normalizeRole(profile.role))) {
        return true
      }

      console.warn('Acceso denegado: Se requiere rol', requiredRoles)
      return { name: 'profile' }
    }

    return true
  } catch (error) {
    const reason = isTimeoutError(error) ? 'timeout' : error?.message
    console.warn('No se pudo completar la validación de ruta:', reason)
    return session ? { name: 'profile' } : { name: 'login' }
  }
})

// Actualiza document.title en cada cambio de ruta
router.afterEach((to) => {
  const pageTitle = to.meta?.title
  document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME
})

export default router
