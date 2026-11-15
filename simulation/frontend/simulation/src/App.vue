<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import SiteHeader from '@/components/common/SiteHeader.vue'

const route = useRoute()
const immersive = computed(() => route.meta.immersive === true)
const withHeader = computed(() => route.meta.portal === true)

watchEffect(() => {
  document.documentElement.classList.toggle('portal-mode', withHeader.value)
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--immersive': immersive }">
    <SiteHeader v-if="withHeader" />
    <RouterView v-slot="{ Component, route: currentRoute }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="currentRoute.path" />
      </Transition>
    </RouterView>
  </div>
</template>
