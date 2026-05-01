<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  show: Boolean,
  count: Number,
  title: {
    type: String,
    default: 'Confirmar eliminación'
  }
})

const emit = defineEmits(['confirm', 'close'])

// Manejar la tecla Escape para cerrar
function handleEscape(e) {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div 
    v-if="show" 
    class="modal-backdrop-custom d-flex align-items-center justify-content-center"
    @click.self="$emit('close')"
  >
    <div 
      class="modal-dialog modal-dialog-centered border-0 shadow-lg" 
      style="width: 100%; max-width: 450px;"
      role="document"
    >
      <div class="modal-content border-0 overflow-hidden" style="border-radius: 0.5em;">
        <div class="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-center">
          <h5 class="modal-title fw-bold text-dark">
            <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
            {{ title }}
          </h5>
          <button type="button" class="btn-close" @click="$emit('close')" aria-label="Close"></button>
        </div>
        
        <div class="modal-body p-4">
          <p class="mb-0 text-secondary">
            Estás a punto de eliminar <strong>{{ count }}</strong> {{ count === 1 ? 'registro' : 'registros' }}. 
            Esta acción no se puede deshacer. ¿Deseas continuar?
          </p>
        </div>
        
        <div class="modal-footer border-0 p-4 pt-0 d-flex gap-2">
          <button 
            type="button" 
            class="btn btn-dark px-4 rounded-pill" 
            @click="$emit('confirm')"
          >
            Sí, eliminar
          </button>
          <button 
            type="button" 
            class="btn btn-light border px-4 rounded-pill" 
            @click="$emit('close')"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop-custom {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 2000;
  padding: 1rem;
}

.modal-content {
  background: white;
  animation: modalScaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalScaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.btn {
  font-weight: 500;
}
</style>
