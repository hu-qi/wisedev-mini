<script setup lang="ts">
import { ref } from 'vue'

const msg = ref('Hello Vue 3 + Vite + Mock!')
</script>

<template>
  <div>
    <h1>{{ msg }}</h1>
  </div>
</template>

<style scoped>
h1 {
  color: #42b883;
}
</style>