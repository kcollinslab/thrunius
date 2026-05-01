<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const saveLoading = ref(false)
const feedback = ref({ type: '', message: '' })
const currentUserId = ref(null)

const form = ref({
  full_name: '',
  about: '',
  birth_date: '',
  gender: '',
  role: 'subscriber'
})

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    router.push('/login')
    return
  }
  currentUserId.value = session.user.id
  await fetchProfile()
})

async function fetchProfile() {
  const profileId = route.params.id
  if (!profileId) return

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()

    if (error) throw error

    if (data) {
      form.value = {
        full_name: data.full_name || '',
        about: data.about || '',
        birth_date: data.birth_date || '',
        gender: data.gender || '',
        role: data.role || 'subscriber'
      }
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
    feedback.value = { type: 'danger', message: 'No se pudo cargar el perfil del usuario.' }
  } finally {
    loading.value = false
  }
}

async function handleUpdateProfile() {
  if (!form.value.full_name) {
    feedback.value = { type: 'danger', message: 'El nombre completo es obligatorio.' }
    return
  }

  saveLoading.value = true
  feedback.value = { type: '', message: '' }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.value.full_name,
        about: form.value.about,
        birth_date: form.value.birth_date || null,
        gender: form.value.gender || null,
        role: form.value.role,
        updated_at: new Date().toISOString()
      })
      .eq('id', route.params.id)

    if (error) throw error

    feedback.value = { type: 'success', message: '¡Perfil actualizado exitosamente!' }

    setTimeout(() => {
      router.push('/profiles')
    }, 1500)

  } catch (error) {
    console.error('Error updating profile:', error)
    feedback.value = { type: 'danger', message: 'Error al actualizar el perfil.' }
  } finally {
    saveLoading.value = false
  }
}
</script>

<template>
  <div class="container-fluid py-3">
    <div class="row justify-content-center">
      <div class="col-md-12 col-xl-8">

        <!-- Estado de Carga Inicial -->
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border text-dark" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
        </div>

        <!-- Formulario -->
        <div v-else class="card shadow-sm border-0 profile-card">
          <div class="card-body p-4">
            <div v-if="feedback.message" class="alert alert-dismissible fade show" :class="`alert-${feedback.type}`" role="alert">
              {{ feedback.message }}
              <button type="button" class="btn-close" @click="feedback.message = ''"></button>
            </div>

            <form @submit.prevent="handleUpdateProfile">
              <!-- Nombre y Rol -->
              <div class="row g-4 mb-4">
                <div class="col-md-8">
                  <label class="form-label fw-bold">Nombre completo</label>
                  <input
                    v-model="form.full_name"
                    type="text"
                    class="form-control"
                    placeholder="Nombre y apellidos"
                    required
                  >
                </div>
                <div class="col-md-4">
                  <label class="form-label fw-bold">Rol</label>
                  <select v-model="form.role" class="form-select" :disabled="route.params.id === currentUserId">
                    <option value="subscriber">Suscriptor</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <div v-if="route.params.id === currentUserId" class="form-text text-info small mt-1">
                    <i class="bi bi-info-circle me-1"></i> No puedes cambiar tu propio rol.
                  </div>
                </div>
              </div>

              <!-- Género y Fecha de Nacimiento -->
              <div class="row g-4 mb-4">
                <div class="col-md-6">
                  <label class="form-label fw-bold">Género</label>
                  <select v-model="form.gender" class="form-select">
                    <option value="">Sin especificar</option>
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                    <option value="Otro">Otro</option>
                    <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold">Fecha de nacimiento</label>
                  <input
                    v-model="form.birth_date"
                    type="date"
                    class="form-control"
                  >
                </div>
              </div>

              <!-- Acerca de -->
              <div class="mb-5">
                <label class="form-label fw-bold">Acerca de</label>
                <textarea
                  v-model="form.about"
                  class="form-control"
                  rows="4"
                  placeholder="Breve descripción del usuario..."
                ></textarea>
              </div>

              <!-- Acciones -->
              <div class="d-flex gap-2 border-top pt-4">
                <button
                  type="submit"
                  class="btn btn-dark px-4 rounded-pill"
                  :disabled="saveLoading"
                >
                  <span v-if="saveLoading" class="spinner-border spinner-border-sm me-2"></span>
                  Guardar cambios
                </button>
                <router-link to="/profiles" class="btn btn-light border px-4 rounded-pill">
                  Cancelar
                </router-link>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-card {
  border-radius: 0.5em;
}
.form-control, .form-select {
  border-radius: 0.5em;
}
</style>
