<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    size?: number | string
    strokeWidth?: number
  }>(),
  { size: 18, strokeWidth: 1.6 },
)
</script>

<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <g v-if="name === 'arrow-right' || name === 'arrow-left'">
      <path d="M4 12h16" />
      <path v-if="name === 'arrow-right'" d="m14 6 6 6-6 6" />
      <path v-else d="m10 6-6 6 6 6" />
    </g>
    <g v-else-if="name === 'arrow-up-right'">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </g>
    <g v-else-if="name === 'chevron-right'">
      <path d="m9 5 7 7-7 7" />
    </g>
    <g v-else-if="name === 'chevron-down'">
      <path d="m5 9 7 7 7-7" />
    </g>
    <g v-else-if="name === 'chevron-up'">
      <path d="m5 15 7-7 7 7" />
    </g>
    <g v-else-if="name === 'arrow-up'">
      <path d="M12 20V4" />
      <path d="m6 10 6-6 6 6" />
    </g>
    <g v-else-if="name === 'close' || name === 'x'">
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </g>
    <g v-else-if="name === 'check'">
      <path d="m4 12.5 5 5L20 6.5" />
    </g>
    <g v-else-if="name === 'pause'">
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </g>
    <g v-else-if="name === 'play'">
      <path d="M8 5.5v13l10-6.5-10-6.5Z" />
    </g>
    <g v-else-if="name === 'refresh'">
      <path d="M20 11a8 8 0 1 0-2.34 5.66" />
      <path d="M20 4v7h-7" />
    </g>
    <g v-else-if="name === 'home'">
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-6h6v6" />
    </g>
    <g v-else-if="name === 'download'">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </g>
    <g v-else-if="name === 'graph'">
      <rect x="3" y="3" width="6" height="6" rx="1.4" />
      <rect x="15" y="15" width="6" height="6" rx="1.4" />
      <rect x="15" y="3" width="6" height="6" rx="1.4" />
      <path d="M9 6h6" />
      <path d="M18 9v6" />
      <path d="M9 9v6h6" />
    </g>
    <g v-else-if="name === 'alert'">
      <path d="M12 3 2.8 19h18.4L12 3Z" />
      <path d="M12 9v4" />
      <path d="M12 16.5h.01" />
    </g>
    <g v-else-if="name === 'shield'">
      <path d="M12 3 4.5 6v6c0 4.5 3 7.5 7.5 9 4.5-1.5 7.5-4.5 7.5-9V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </g>
    <g v-else-if="name === 'activity'">
      <path d="M3 12h4l2.5-7 5 14 2.5-7H21" />
    </g>
    <g v-else-if="name === 'scan'">
      <path d="M4 8V5a1 1 0 0 1 1-1h3" />
      <path d="M16 4h3a1 1 0 0 1 1 1v3" />
      <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
      <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M7 12h10" />
    </g>
    <g v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </g>
    <g v-else-if="name === 'layers'">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </g>
    <g v-else-if="name === 'eye'">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </g>
    <g v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </g>
    <g v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </g>
    <g v-else-if="name === 'spark'">
      <path d="M12 3c.7 4.5 2.5 7 7 7-4.5.7-6.3 3.3-7 8-.7-4.7-2.5-7.3-7-8 4.5 0 6.3-2.5 7-7Z" />
      <path d="M19 16c.3 1.8 1 2.6 2.8 2.9-1.8.3-2.5 1.1-2.8 3-.3-1.9-1-2.7-2.8-3 1.8-.3 2.5-1.1 2.8-2.9Z" />
    </g>
    <g v-else-if="name === 'keyboard'">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M18 10h.01M7 14h.01M11 14h.01M15 14h.01M18 14h.01" />
    </g>
    <g v-else-if="name === 'route'">
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H14a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h.5" />
    </g>
    <g v-else-if="name === 'cpu'">
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </g>
    <g v-else-if="name === 'copy'">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </g>
    <g v-else-if="name === 'trash'">
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6 7 1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </g>
    <g v-else-if="name === 'experiment'">
      <path d="M9 3h6" />
      <path d="M10 3v6l-5.2 8.4A2.1 2.1 0 0 0 6.5 21h11a2.1 2.1 0 0 0 1.8-3.6L14 9V3" />
      <path d="M7.2 15h9.6" />
      <path d="M12 17.5h.01" />
    </g>
    <g v-else-if="name === 'book-open' || name === 'book'">
      <path d="M3 5.5C5.6 4.2 8.4 4 12 5.6c3.6-1.6 6.4-1.4 9-.1v13c-2.6-1.3-5.4-1.5-9 .1-3.6-1.6-6.4-1.4-9-.1v-13Z" />
      <path d="M12 5.6v13" />
    </g>
    <g v-else-if="name === 'chart'">
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="m7.5 15 3.5-4 3 2.4L20 7" />
      <path d="M16.5 7H20v3.5" />
    </g>
    <g v-else-if="name === 'mail'">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </g>
    <g v-else-if="name === 'message'">
      <path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2.2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v8Z" />
      <path d="M8 9h8M8 12.5h5" />
    </g>
    <g v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </g>
    <g v-else-if="name === 'users'">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </g>
    <g v-else-if="name === 'menu'">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </g>
    <g v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </g>
    <g v-else-if="name === 'lock'">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </g>
    <g v-else-if="name === 'compass'">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </g>
    <g v-else-if="name === 'database'">
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      <path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </g>
    <g v-else-if="name === 'network'">
      <circle cx="12" cy="12" r="3" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="m6.7 7.2 3 3M17.3 7.2l-3 3M6.7 16.8l3-3M17.3 16.8l-3-3" />
    </g>
    <g v-else-if="name === 'building'">
      <path d="M4 21V5l8-2v18" />
      <path d="M12 8h8v13" />
      <path d="M2 21h20" />
      <path d="M7 7h2M7 11h2M7 15h2M15 11h2M15 15h2" />
    </g>
    <g v-else>
      <circle cx="12" cy="12" r="9" />
    </g>
  </svg>
</template>

<style scoped>
.icon {
  display: block;
  flex: none;
}
</style>
