<script setup>
const props = defineProps({
  id: {
    type: String,
    default: undefined,
  },
  placeholder: {
    type: String,
    default: 'Buscar',
  },
  ariaLabel: {
    type: String,
    default: 'Buscar',
  },
  clearLabel: {
    type: String,
    default: 'Limpiar búsqueda',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  autofocus: {
    type: Boolean,
    default: false,
  },
})

const searchValue = defineModel({
  type: String,
  default: '',
})

const emit = defineEmits(['clear'])

function clearSearch() {
  if (props.disabled || !searchValue.value) return
  searchValue.value = ''
  emit('clear')
}
</script>

<template>
  <div class="input-search-control">
    <i class="bi bi-search search-icon" aria-hidden="true"></i>
    <input
      :id="id"
      v-model="searchValue"
      type="search"
      class="form-control"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :disabled="disabled"
      :autofocus="autofocus"
    >
    <button
      v-if="searchValue"
      type="button"
      class="clear-search"
      :aria-label="clearLabel"
      :title="clearLabel"
      :disabled="disabled"
      @click="clearSearch"
    >
      <i class="bi bi-x-lg" aria-hidden="true"></i>
    </button>
  </div>
</template>

<style scoped>
.input-search-control {
  position: relative;
  width: 100%;
}

.form-control {
  border-color: #d5d9dd;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  height: 2.5rem;
  padding-left: 2.35rem;
  padding-right: 2.25rem;
}

.form-control::-webkit-search-cancel-button {
  appearance: none;
}

.form-control:focus {
  border-color: #495057;
  box-shadow: 0 0 0 0.18rem rgba(33, 37, 41, 0.08);
}

.search-icon,
.clear-search {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
}

.search-icon {
  color: #7a828a;
  left: 0.85rem;
  pointer-events: none;
}

.clear-search {
  align-items: center;
  background: transparent;
  border: 0;
  color: #6c757d;
  display: flex;
  height: 2rem;
  justify-content: center;
  right: 0.25rem;
  width: 2rem;
}

.clear-search:hover:not(:disabled) {
  color: #212529;
}

.clear-search:focus-visible {
  border-radius: 0.35rem;
  box-shadow: 0 0 0 2px rgba(33, 37, 41, 0.22);
  outline: 0;
}

.form-control:disabled + .clear-search {
  opacity: 0.55;
}
</style>
