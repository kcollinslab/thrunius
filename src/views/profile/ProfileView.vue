<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const user = ref(null)
const profile = ref({
  full_name: '',
  about: '',
  birth_date: '',
  gender: ''
})

const loading = ref(true)
const isEditing = ref(false)
const updateLoading = ref(false)
const feedback = ref({ type: '', message: '' })

const ROLE_LABELS = {
  admin: { label: 'Administrador', class: 'text-bg-dark' },
  editor: { label: 'Editor', class: 'text-bg-primary' },
  subscriber: { label: 'Suscriptor', class: 'text-bg-secondary' },
}

function getRoleBadge(role) {
  return ROLE_LABELS[role] || { label: role || 'Sin rol', class: 'text-bg-light' }
}

onMounted(async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error || !session) {
    router.push('/login')
    return
  }

  user.value = session.user
  
  // Cargar datos adicionales de la tabla profiles
  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.value.id)
    .single()

  if (data) {
    profile.value = data
  }
  
  loading.value = false
})

async function handleUpdateProfile() {
  updateLoading.value = true
  feedback.value = { type: '', message: '' }
  
  try {
    if (!user.value?.id) {
       throw new Error('ID de usuario no encontrado en la sesión actual.');
    }

    // 1. Actualizar tabla profiles PRIMERO
    const payload = {
      full_name: profile.value.full_name,
      about: profile.value.about || null,
      birth_date: profile.value.birth_date || null,
      gender: profile.value.gender || null,
      updated_at: new Date().toISOString(),
    };
    
    const { error: profileError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.value.id)

    if (profileError) throw profileError

    // 2. Intentar actualizar metadatos de Auth (secundario, NO bloqueante)
    supabase.auth.updateUser({
      data: { display_name: profile.value.full_name }
    })

    isEditing.value = false
    feedback.value = { type: 'success', message: '¡Perfil actualizado correctamente!' }
  } catch (error) {
    console.error('[ProfileView] Error crítico al actualizar:', error)
    feedback.value = { type: 'danger', message: error.message || 'Error al actualizar.' }
  } finally {
    updateLoading.value = false
  }
}


</script>

<template>
  <div class="profile-view container py-5">
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-dark" role="status">
        <span class="visually-hidden">Cargando...</span>
      </div>
    </div>

    <div v-else-if="user" class="row justify-content-center">
      <div class="col-12 col-md-10 col-lg-8">
        <div class="card shadow-sm border-0 overflow-hidden profile-card">
          <div class="bg-dark p-4 text-white text-center">
            <div class="mb-3">
              <i class="bi bi-person-circle display-1"></i>
            </div>
            <h1 class="h3 fw-bold mb-1">{{ profile.full_name || 'Mi Perfil' }}</h1>
            <div class="d-flex justify-content-center">
              <span class="badge text-uppercase py-2 px-3" :class="getRoleBadge(profile.role).class" style="font-size: 0.7rem; letter-spacing: 0.05em;">
                {{ getRoleBadge(profile.role).label }}
              </span>
            </div>
          </div>
          
          <div class="card-body p-4">
            <div v-if="feedback.message" class="alert alert-dismissible fade show" :class="`alert-${feedback.type}`" role="alert">
              {{ feedback.message }}
              <button type="button" class="btn-close" @click="feedback.message = ''"></button>
            </div>

            <div v-if="!isEditing" class="profile-info">
              <div class="row g-4 mb-4">
                <div class="col-md-6">
                  <label class="text-muted small fw-bold text-uppercase mb-2 d-block">Nombre Completo</label>
                  <p class="fw-semibold">{{ profile.full_name || 'No especificado' }}</p>
                </div>
                <div class="col-md-6">
                  <label class="text-muted small fw-bold text-uppercase mb-2 d-block">Correo Electrónico</label>
                  <p class="text-secondary">{{ user.email }}</p>
                </div>
                <div class="col-md-6">
                  <label class="text-muted small fw-bold text-uppercase mb-2 d-block">Género</label>
                  <p>{{ profile.gender || 'No especificado' }}</p>
                </div>
                <div class="col-md-6">
                  <label class="text-muted small fw-bold text-uppercase mb-2 d-block">Fecha de Nacimiento</label>
                  <p>{{ profile.birth_date ? new Date(profile.birth_date).toLocaleDateString() : 'No especificada' }}</p>
                </div>
                <div class="col-12">
                  <label class="text-muted small fw-bold text-uppercase mb-2 d-block">Sobre mí</label>
                  <p class="bg-light p-3 about-text">{{ profile.about || 'Cuéntanos algo sobre ti...' }}</p>
                </div>
              </div>
              <button @click="isEditing = true" class="btn btn-dark rounded-pill px-4">
                <i class="bi bi-pencil-square me-2"></i> Editar Perfil
              </button>
            </div>

            <form v-else @submit.prevent="handleUpdateProfile" class="profile-form">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label fw-bold">Nombre Completo</label>
                  <input v-model="profile.full_name" type="text" class="form-control" placeholder="Escribe tu nombre">
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold">Género</label>
                  <select v-model="profile.gender" class="form-select">
                    <option value="">Selecciona una opción</option>
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                    <option value="Otro">Otro</option>
                    <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold">Fecha de Nacimiento</label>
                  <input v-model="profile.birth_date" type="date" class="form-control">
                </div>
                <div class="col-12">
                  <label class="form-label fw-bold">Sobre mí</label>
                  <textarea v-model="profile.about" class="form-control" rows="3" placeholder="Algo sobre ti..."></textarea>
                </div>
                <div class="col-12 mt-4 d-flex gap-2">
                  <button type="submit" class="btn btn-dark rounded-pill px-4" :disabled="updateLoading">
                    <span v-if="updateLoading" class="spinner-border spinner-border-sm me-1"></span>
                    Guardar Cambios
                  </button>
                  <button type="button" @click="isEditing = false" class="btn btn-light border rounded-pill px-4" :disabled="updateLoading">
                    Cancelar
                  </button>
                </div>
              </div>
            </form>


          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  border: none;
}
.profile-card {
  border-radius: 0.5em;
}
.about-text {
  border-radius: 0.5em;
}
.bg-dark {
  background: linear-gradient(135deg, #111 0%, #333 100%) !important;
}
.form-control:focus, .form-select:focus {
  border-color: #212529;
  box-shadow: 0 0 0 0.25rem rgba(33, 37, 41, 0.1);
}
</style>
