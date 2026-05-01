<script setup>
import RegisterForm from '../../components/RegisterForm.vue'
import '../../assets/auth.css'
</script>

<template>
  <main class="auth-view">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
          <section class="auth-card bg-white overflow-hidden">
            <div class="auth-card-body">
              <RegisterForm />

              <div class="text-center">
                <p class="text-muted mb-0">
                  ¿Ya tienes una cuenta?
                  <RouterLink to="/login" class="auth-link fw-bold text-decoration-none">
                    Inicia sesión
                  </RouterLink>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </main>
</template>
