<script setup lang="ts">
import { computed, useId } from 'vue'
import type { ExperimentArtwork } from '@/models/experiment.model'

const props = withDefaults(
  defineProps<{
    kind: ExperimentArtwork
    accent?: string
    accentRgb?: string
  }>(),
  {
    accent: '#0f6e84',
    accentRgb: '15, 110, 132',
  },
)

const uid = `theme-art-${useId()}`

const ids = {
  sky: `${uid}-sky`,
  glow: `${uid}-glow`,
  edge: `${uid}-edge`,
  grid: `${uid}-grid`,
  warm: `${uid}-warm`,
}

const skyFill = computed(() => `url(#${ids.sky})`)
const glowFill = computed(() => `url(#${ids.glow})`)
const edgeFill = computed(() => `url(#${ids.edge})`)
const gridFill = computed(() => `url(#${ids.grid})`)
const warmFill = computed(() => `url(#${ids.warm})`)

const frameStyle = computed(() => ({
  '--art-accent': props.accent,
  '--art-rgb': props.accentRgb,
}))
</script>

<template>
  <div class="artwork" :class="`artwork--${kind}`" :style="frameStyle" aria-hidden="true">
    <svg viewBox="0 0 640 400" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient :id="ids.sky" x1="320" y1="0" x2="320" y2="400" gradientUnits="userSpaceOnUse">
          <stop stop-color="#f6f9fb" />
          <stop offset="0.52" stop-color="#edf2f5" />
          <stop offset="1" stop-color="#e6edf1" />
        </linearGradient>
        <radialGradient :id="ids.glow" cx="0.5" cy="0.5" r="0.5">
          <stop stop-color="var(--art-accent)" stop-opacity="0.34" />
          <stop offset="0.58" stop-color="var(--art-accent)" stop-opacity="0.08" />
          <stop offset="1" stop-color="var(--art-accent)" stop-opacity="0" />
        </radialGradient>
        <linearGradient :id="ids.edge" x1="0" y1="0" x2="640" y2="0" gradientUnits="userSpaceOnUse">
          <stop stop-color="var(--art-accent)" stop-opacity="0" />
          <stop offset="0.32" stop-color="var(--art-accent)" stop-opacity="0.6" />
          <stop offset="0.68" stop-color="var(--art-accent)" stop-opacity="0.6" />
          <stop offset="1" stop-color="var(--art-accent)" stop-opacity="0" />
        </linearGradient>
        <pattern :id="ids.grid" width="38" height="38" patternUnits="userSpaceOnUse">
          <path d="M38 0H0V38" fill="none" stroke="#2f7387" stroke-opacity="0.055" />
        </pattern>
        <radialGradient :id="ids.warm" cx="0.5" cy="0.5" r="0.5">
          <stop stop-color="#c4703a" stop-opacity="0.78" />
          <stop offset="0.5" stop-color="#b0622f" stop-opacity="0.2" />
          <stop offset="1" stop-color="#b0622f" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect width="640" height="400" :fill="skyFill" />
      <rect width="640" height="400" :fill="gridFill" opacity="0.72" />
      <ellipse cx="512" cy="86" rx="238" ry="174" :fill="glowFill" opacity="0.72" />

      <!-- 电车悖论 ------------------------------------------------------- -->
      <g v-if="kind === 'trolley'" class="scene scene--trolley">
        <g fill="#c3d5dd" opacity="0.92">
          <rect x="0" y="252" width="36" height="86" />
          <rect x="42" y="228" width="26" height="110" />
          <rect x="74" y="264" width="48" height="74" />
          <rect x="130" y="240" width="20" height="98" />
          <rect x="158" y="272" width="58" height="66" />
          <rect x="228" y="248" width="26" height="90" />
          <rect x="262" y="216" width="34" height="122" />
          <rect x="306" y="258" width="50" height="80" />
          <rect x="364" y="236" width="22" height="102" />
          <rect x="394" y="268" width="46" height="70" />
          <rect x="450" y="244" width="30" height="94" />
          <rect x="490" y="226" width="52" height="112" />
          <rect x="552" y="260" width="24" height="78" />
          <rect x="584" y="240" width="56" height="98" />
        </g>
        <g fill="var(--art-accent)" opacity="0.32">
          <rect x="50" y="240" width="9" height="2" />
          <rect x="88" y="280" width="21" height="2" />
          <rect x="170" y="288" width="31" height="2" />
          <rect x="271" y="232" width="15" height="2" />
          <rect x="318" y="278" width="24" height="2" />
          <rect x="404" y="284" width="21" height="2" />
          <rect x="506" y="246" width="22" height="2" />
          <rect x="596" y="258" width="27" height="2" />
        </g>
        <path d="M0 338H640" stroke="var(--art-accent)" stroke-opacity="0.12" />

        <!-- 轨道 -->
        <g stroke="var(--art-accent)" stroke-linecap="round" fill="none">
          <path d="M208 400C268 330 308 278 320 208" stroke-opacity="0.26" stroke-width="2.2" />
          <path d="M248 400C292 334 322 280 334 208" stroke-opacity="0.16" stroke-width="2.2" />
          <path d="M437 400C402 338 372 290 350 246" stroke-opacity="0.22" stroke-width="2.2" />
          <path d="M474 400C432 342 390 296 366 252" stroke-opacity="0.13" stroke-width="2.2" />
          <path d="M337 236C353 250 395 292 432 348" stroke-opacity="0.42" stroke-width="1.4" stroke-dasharray="4 7" />
        </g>
        <g stroke="var(--art-accent)" stroke-opacity="0.16">
          <path d="M190 368h56M208 336h72M234 302h64M264 270h46M290 240h34" />
          <path d="M424 366h78M402 336h76M382 306h62M370 276h34" />
        </g>

        <!-- 电车 -->
        <g class="trolley-body" transform="translate(280 132)">
          <rect x="0" y="14" width="82" height="96" rx="9" fill="#2c4c58" stroke="var(--art-accent)" stroke-opacity="0.62" />
          <path d="M8 30h66v32H8z" fill="#3c6270" stroke="var(--art-accent)" stroke-opacity="0.34" />
          <path d="M8 74h66M8 92h66" stroke="var(--art-accent)" stroke-opacity="0.18" />
          <path d="M15 14 5-9M67 14l10-23" stroke="var(--art-accent)" stroke-opacity="0.4" />
          <path d="M5-9h72" stroke="var(--art-accent)" stroke-opacity="0.32" />
          <circle cx="17" cy="106" r="7" fill="#8a5a2b" filter="blur(1px)" />
          <circle cx="65" cy="106" r="7" fill="#8a5a2b" filter="blur(1px)" />
          <circle cx="17" cy="106" r="3" fill="#5c3a18" />
          <circle cx="65" cy="106" r="3" fill="#5c3a18" />
          <path d="M15 112 2 180h34l-4-68Z" fill="var(--art-accent)" fill-opacity="0.08" />
          <path d="M67 112 62 180h32l-11-68Z" fill="var(--art-accent)" fill-opacity="0.08" />
        </g>
        <ellipse cx="322" cy="152" rx="88" ry="38" :fill="glowFill" opacity="0.55" />

        <!-- 作业人员 -->
        <g class="crowd-main" fill="#7a4a20">
          <g v-for="(point, index) in [[309, 246], [323, 238], [336, 248], [318, 258], [333, 260]]" :key="`worker-${index}`">
            <circle :cx="point[0]" :cy="point[1]" r="2.4" />
            <path :d="`M${point[0]} ${point[1] + 2}v7m-3 -4 3 3 3-3m-5 8 2 4m3-4-2 4`" stroke="#7a4a20" stroke-opacity="0.5" stroke-width="1" />
          </g>
        </g>
        <g fill="#7a4a20">
          <circle cx="409" cy="264" r="2.4" />
          <path d="M409 266v7m-3-4 3 3 3-3m-5 8 2 4m3-4-2 4" stroke="#7a4a20" stroke-opacity="0.45" stroke-width="1" />
        </g>
        <g font-family="var(--font-mono)" font-size="9" fill="var(--art-accent)">
          <circle cx="289" cy="220" r="11" stroke="var(--art-accent)" stroke-opacity="0.34" />
          <text x="289" y="223" text-anchor="middle">5</text>
          <circle cx="438" cy="242" r="11" stroke="var(--art-accent)" stroke-opacity="0.34" />
          <text x="438" y="245" text-anchor="middle">1</text>
        </g>

        <!-- 道岔手柄 -->
        <g class="lever" transform="translate(92 302)">
          <ellipse cx="36" cy="86" rx="70" ry="18" :fill="glowFill" opacity="0.42" />
          <path d="M0 66h76l10 20H-10Z" fill="#2c4c58" stroke="var(--art-accent)" stroke-opacity="0.5" />
          <path d="M35 66 63 6" stroke="var(--art-accent)" stroke-opacity="0.78" stroke-width="5" stroke-linecap="round" />
          <circle cx="63" cy="6" r="9" fill="#c4703a" fill-opacity="0.85" stroke="#8a5a2b" stroke-opacity="0.9" />
          <circle cx="63" cy="6" r="20" :fill="warmFill" opacity="0.9" />
          <path d="M-18 90h122" stroke="var(--art-accent)" stroke-opacity="0.24" />
          <text x="0" y="56" fill="var(--art-accent)" font-family="var(--font-mono)" font-size="8" letter-spacing="2">SWITCH / MANUAL</text>
        </g>

        <g font-family="var(--font-mono)" fill="var(--art-accent)">
          <text x="486" y="344" font-size="9" letter-spacing="2.2" opacity="0.7">T - 00:75</text>
          <text x="486" y="360" font-size="7" letter-spacing="1.8" opacity="0.4">UNREVERSIBLE</text>
        </g>
        <path d="M0 340H640" :stroke="edgeFill" stroke-opacity="0.36" />
        <circle cx="556" cy="96" r="26" stroke="#c4703a" stroke-opacity="0.35" />
        <path d="M556 84v14" stroke="#c4703a" stroke-opacity="0.7" stroke-width="2" stroke-linecap="round" />
        <circle cx="556" cy="104" r="1.8" fill="#c4703a" />
      </g>

      <!-- 都江堰水利 ----------------------------------------------------- -->
      <g v-else-if="kind === 'dujiangyan'" class="scene scene--dujiangyan">
        <circle cx="526" cy="84" r="44" fill="var(--art-accent)" fill-opacity="0.08" stroke="var(--art-accent)" stroke-opacity="0.24" />
        <circle cx="526" cy="84" r="30" stroke="var(--art-accent)" stroke-opacity="0.12" stroke-dasharray="3 7" />
        <g fill="#b6ccd5">
          <path d="M0 232 82 164l58 48 64-78 58 66 62-52 64 78 58-34 72 52 58-48 64 48v156H0Z" />
        </g>
        <g fill="#a7c1cc" opacity="0.96">
          <path d="M0 276 74 218l62 44 74-54 66 58 72-38 60 52 66-30 66 42 60-26 60 38v82H0Z" />
        </g>
        <g fill="#98b6c2" opacity="0.92">
          <path d="M0 320 88 276l74 28 82-36 76 38 74-24 82 32 72-18 92 34v82H0Z" />
        </g>

        <!-- 分水河道 -->
        <g fill="none" stroke-linecap="round">
          <path d="M300 400C282 354 286 300 314 262C332 236 356 218 374 196" stroke="var(--art-accent)" stroke-opacity="0.16" stroke-width="42" />
          <path d="M382 400C372 346 360 302 344 272C332 250 324 228 324 204" stroke="var(--art-accent)" stroke-opacity="0.1" stroke-width="34" />
          <path d="M300 400C282 354 286 300 314 262C332 236 356 218 374 196" stroke="var(--art-accent)" stroke-opacity="0.46" stroke-width="1.4" stroke-dasharray="11 15" />
          <path d="M382 400C372 346 360 302 344 272C332 250 324 228 324 204" stroke="var(--art-accent)" stroke-opacity="0.32" stroke-width="1.2" stroke-dasharray="8 16" />
          <path d="M466 400C440 346 420 306 402 272C388 246 382 220 384 194" stroke="var(--art-accent)" stroke-opacity="0.18" stroke-width="1.2" stroke-dasharray="5 13" />
        </g>
        <g stroke="var(--art-accent)" stroke-opacity="0.13">
          <path d="M236 364c48-16 84-42 104-78M248 392c52-20 92-50 112-90M444 382c-38-28-62-60-70-96" />
        </g>

        <!-- 鱼嘴 -->
        <path d="M306 224c20 10 34 25 36 44-12 14-34 20-60 16 16-18 24-38 24-60Z" fill="#7fa8b4" stroke="var(--art-accent)" stroke-opacity="0.55" />
        <path d="M320 230c12 14 18 28 16 42" stroke="var(--art-accent)" stroke-opacity="0.5" />
        <path d="M306 224c-22-14-52-18-76-8" stroke="var(--art-accent)" stroke-opacity="0.35" />

        <!-- 飞沙堰 -->
        <g stroke="var(--art-accent)" stroke-opacity="0.44">
          <path d="M402 238v76M414 234v82M426 232v86M438 234v82M450 238v76" />
          <path d="M394 250h64M394 274h64M394 298h64" stroke-opacity="0.2" />
        </g>
        <path d="M392 320c22-10 48-10 70 0" stroke="var(--art-accent)" stroke-opacity="0.5" />
        <ellipse cx="428" cy="322" rx="52" ry="14" :fill="glowFill" opacity="0.55" />

        <!-- 宝瓶口 -->
        <path d="M514 286c-18 10-24 32-14 50 8 16 30 22 46 10 14-11 16-32 5-46-8-10-24-18-37-14Z" fill="#7fa8b4" stroke="var(--art-accent)" stroke-opacity="0.3" />
        <path d="M512 306c-2 18 8 32 24 34" stroke="var(--art-accent)" stroke-opacity="0.45" />

        <g font-family="var(--font-mono)" fill="var(--art-accent)">
          <text x="280" y="206" font-size="8" letter-spacing="1.8" opacity="0.7">FISH MOUTH</text>
          <text x="416" y="220" font-size="7" letter-spacing="1.8" opacity="0.55">FLY SAND WEIR</text>
          <text x="522" y="360" font-size="7" letter-spacing="1.8" opacity="0.5">BOTTLE NECK</text>
          <text x="44" y="356" font-size="7" letter-spacing="1.8" opacity="0.4">MIN RIVER / 岷江</text>
        </g>
        <g font-family="var(--font-mono)" font-size="8" fill="var(--art-accent)" opacity="0.65">
          <text x="428" y="178">60% / 40%</text>
          <path d="M428 184v16" stroke="var(--art-accent)" stroke-opacity="0.3" />
        </g>
        <path d="M0 348H640" :stroke="edgeFill" stroke-opacity="0.3" />
      </g>

      <!-- 自动驾驶 ------------------------------------------------------- -->
      <g v-else-if="kind === 'autonomous'" class="scene scene--autonomous">
        <g fill="#c3d5dd" opacity="0.9">
          <rect x="0" y="190" width="42" height="108" />
          <rect x="48" y="160" width="28" height="138" />
          <rect x="84" y="206" width="50" height="92" />
          <rect x="142" y="172" width="22" height="126" />
          <rect x="172" y="216" width="54" height="82" />
          <rect x="414" y="202" width="46" height="96" />
          <rect x="468" y="166" width="28" height="132" />
          <rect x="504" y="190" width="58" height="108" />
          <rect x="570" y="154" width="30" height="144" />
          <rect x="606" y="208" width="34" height="90" />
        </g>
        <g class="rain" stroke="#4e7f8e" stroke-opacity="0.18" stroke-width="1">
          <path d="M40 18 30 66M92 42 82 90M138 12 128 60M192 32 182 80M340 16 330 64M390 44 380 92M448 10 438 58M500 36 490 84M552 18 542 66M600 46 590 94" />
        </g>
        <path d="M0 298H640" stroke="var(--art-accent)" stroke-opacity="0.12" />

        <!-- 道路 -->
        <path d="M242 220h156l242 180H0Z" fill="#c3d5dd" />
        <path d="M242 220 0 400M398 220l242 180" stroke="var(--art-accent)" stroke-opacity="0.24" />
        <g stroke="var(--art-accent)" stroke-opacity="0.2" stroke-dasharray="18 18">
          <path d="M320 230v40M320 292v40M320 354v30" />
          <path d="M370 230 548 400M270 230 92 400" stroke-dasharray="12 22" stroke-opacity="0.1" />
        </g>
        <g stroke="#557f8b" stroke-opacity="0.24">
          <path d="M158 320h324M150 336h340M142 352h356M134 368h372M126 384h388" stroke-width="3" />
        </g>

        <!-- 对向货车 -->
        <g opacity="0.6">
          <path d="M478 168h56v52h-56z" fill="#2c4c58" stroke="var(--art-accent)" stroke-opacity="0.42" />
          <path d="M486 176h30v16h-30z" fill="var(--art-accent)" fill-opacity="0.14" />
          <circle cx="492" cy="222" r="6" fill="#2c4c58" stroke="var(--art-accent)" stroke-opacity="0.4" />
          <circle cx="522" cy="222" r="6" fill="#2c4c58" stroke="var(--art-accent)" stroke-opacity="0.4" />
          <path d="M478 190h-22M478 202h-22" stroke="#7a4a20" stroke-opacity="0.45" stroke-width="2" />
          <path d="M456 190 404 170v58l52-18Z" fill="var(--art-accent)" fill-opacity="0.06" />
        </g>

        <!-- 行人 -->
        <g fill="#3f6f7e">
          <g>
            <circle cx="410" cy="246" r="4" />
            <path d="M410 250v11m-5-7 5 4 5-4m-8 12 3 6m4-6-3 6" stroke="#3f6f7e" stroke-opacity="0.6" />
          </g>
          <g>
            <circle cx="426" cy="252" r="4" />
            <path d="M426 256v10m-5-6 5 3 5-3m-8 11 3 6m4-6-3 6" stroke="#3f6f7e" stroke-opacity="0.55" />
          </g>
          <g>
            <circle cx="442" cy="244" r="3.6" />
            <path d="M442 248v9m-4-6 4 3 4-3m-7 10 3 5m3-5-3 5" stroke="#3f6f7e" stroke-opacity="0.5" />
          </g>
        </g>

        <!-- 测试车 -->
        <g class="car" transform="translate(260 308)">
          <path d="M14 22c5-17 22-26 54-26s49 9 54 26l8 42H6l8-42Z" fill="#2c4c58" stroke="var(--art-accent)" stroke-opacity="0.58" />
          <path d="M34 18c6-8 18-12 34-12s28 4 34 12" stroke="var(--art-accent)" stroke-opacity="0.42" />
          <path d="M38 30h60l5 16H33l5-16Z" fill="var(--art-accent)" fill-opacity="0.14" />
          <circle cx="18" cy="66" r="7" stroke="var(--art-accent)" stroke-opacity="0.5" />
          <circle cx="118" cy="66" r="7" stroke="var(--art-accent)" stroke-opacity="0.5" />
          <circle cx="18" cy="66" r="3" fill="var(--art-accent)" fill-opacity="0.3" />
          <circle cx="118" cy="66" r="3" fill="var(--art-accent)" fill-opacity="0.3" />
          <path d="M10 42h-4M130 42h4" stroke="#c34c3c" stroke-width="4" stroke-linecap="round" />
          <path d="M32 56h80" stroke="#c34c3c" stroke-opacity="0.55" stroke-width="2" />
          <rect x="59" y="-4" width="20" height="8" rx="4" stroke="var(--art-accent)" stroke-opacity="0.5" />
          <circle cx="69" cy="-9" r="2.5" fill="var(--art-accent)" />
        </g>
        <g stroke="var(--art-accent)" stroke-opacity="0.32" fill="none">
          <ellipse cx="328" cy="348" rx="118" ry="34" stroke-dasharray="5 9" />
          <ellipse cx="328" cy="348" rx="160" ry="48" stroke-dasharray="5 10" opacity="0.55" />
          <ellipse cx="328" cy="348" rx="202" ry="62" stroke-dasharray="5 11" opacity="0.3" />
        </g>

        <g font-family="var(--font-mono)" fill="var(--art-accent)">
          <text x="506" y="80" font-size="9" letter-spacing="2">VIS / 78%</text>
          <text x="506" y="96" font-size="7" letter-spacing="1.6" opacity="0.45">CONFIDENCE</text>
          <text x="43" y="362" font-size="7" letter-spacing="1.8" opacity="0.5">DECISION WINDOW 2.1s</text>
        </g>
        <circle cx="556" cy="120" r="30" stroke="var(--art-accent)" stroke-opacity="0.2" stroke-dasharray="3 7" />
        <path d="M0 338H640" :stroke="edgeFill" stroke-opacity="0.25" />
      </g>

      <!-- 大楼倒塌 ------------------------------------------------------- -->
      <g v-else-if="kind === 'collapse'" class="scene scene--collapse">
        <g fill="#c3d5dd" opacity="0.88">
          <rect x="0" y="230" width="56" height="90" />
          <rect x="62" y="206" width="30" height="114" />
          <rect x="524" y="222" width="42" height="98" />
          <rect x="572" y="198" width="30" height="122" />
          <rect x="608" y="236" width="32" height="84" />
        </g>
        <path d="M0 318H640" stroke="var(--art-accent)" stroke-opacity="0.14" />

        <!-- 塔吊 -->
        <g stroke="var(--art-accent)" stroke-opacity="0.34">
          <path d="M470 318V118M470 118H586M470 118h-76" />
          <path d="M470 132 566 118M470 150 512 118M470 168 470 118" stroke-opacity="0.16" />
          <path d="M586 118v34M578 152h16" />
          <path d="M470 210l62 46M470 250l32 24" stroke-opacity="0.12" />
        </g>
        <path d="M586 152v42" stroke="#c4703a" stroke-opacity="0.6" stroke-dasharray="3 5" />
        <rect x="578" y="194" width="16" height="11" fill="#c4703a" fill-opacity="0.3" stroke="#c4703a" stroke-opacity="0.55" />

        <!-- 建筑体 -->
        <g>
          <path d="M92 118h170v200H92z" fill="#c3d5dd" stroke="var(--art-accent)" stroke-opacity="0.38" />
          <g fill="var(--art-accent)" fill-opacity="0.13">
            <path d="M110 140h30v22h-30zM158 140h30v22h-30zM206 140h30v22h-30z" />
            <path d="M110 184h30v22h-30zM158 184h30v22h-30zM206 184h30v22h-30z" />
            <path d="M110 228h30v22h-30zM158 228h30v22h-30zM206 228h30v22h-30z" />
          </g>
          <path d="M92 162h170M92 206h170M92 250h170" stroke="var(--art-accent)" stroke-opacity="0.16" />
          <path class="crack" d="M258 124l-15 28 18 20-24 26 20 28-16 30 22 24-13 28" stroke="#c4703a" stroke-opacity="0.72" stroke-width="1.4" />
          <path d="M92 118 208 318" stroke="var(--art-accent)" stroke-opacity="0.08" />
        </g>

        <!-- 基坑与围挡 -->
        <g stroke="var(--art-accent)" stroke-opacity="0.38">
          <path d="M312 318h226l22 30H290l22-30Z" fill="var(--art-accent)" fill-opacity="0.045" />
          <path d="M320 318l-14 30M540 318l14 30" stroke-opacity="0.2" />
          <path d="M334 284h164M334 284v-26M384 284v-26M434 284v-26M484 284v-26" />
          <path d="M328 270h176M328 282h176" stroke-opacity="0.26" />
        </g>
        <path d="M342 268h96" stroke="#c4703a" stroke-opacity="0.8" stroke-width="2" />
        <g fill="#c4703a" fill-opacity="0.1">
          <circle cx="78" cy="284" r="14" />
          <circle cx="120" cy="300" r="22" />
          <circle cx="166" cy="282" r="18" />
          <circle cx="216" cy="302" r="26" />
        </g>
        <path d="M0 326c54-28 110-30 166-16 56 14 110 12 164-6 28-9 54-12 78-9v105H0Z" fill="#c4703a" fill-opacity="0.06" />

        <!-- 校舍 -->
        <g opacity="0.34" stroke="var(--art-accent)">
          <path d="M548 270h76v48h-76z" />
          <path d="M562 284h14v14h-14zM588 284h14v14h-14z" />
          <path d="M584 318v-12h18v12" />
          <path d="M540 262h92" />
          <text x="586" y="256" text-anchor="middle" fill="var(--art-accent)" font-size="7" font-family="var(--font-mono)" stroke="none">SCHOOL</text>
        </g>

        <g font-family="var(--font-mono)" fill="#c4703a">
          <path d="M472 342l18 32h-36l18-32Z" stroke="#c4703a" stroke-opacity="0.6" />
          <path d="M472 352v9" stroke-width="2" />
          <circle cx="472" cy="366" r="1.6" fill="#c4703a" />
          <text x="36" y="356" font-size="7" letter-spacing="1.8" opacity="0.6">RISK / ACCUMULATED</text>
        </g>
        <path d="M0 340H640" :stroke="edgeFill" stroke-opacity="0.25" />
      </g>

      <!-- 医疗分诊 ------------------------------------------------------- -->
      <g v-else-if="kind === 'triage'" class="scene scene--triage">
        <path d="M0 330H640" stroke="var(--art-accent)" stroke-opacity="0.12" />
        <g stroke="var(--art-accent)" stroke-opacity="0.11">
          <path d="M0 86h640M0 170h640M0 254h640M0 338h640" />
          <path d="M110 0v400M236 0v400M362 0v400M488 0v400" />
        </g>

        <g class="cross" transform="translate(320 170)">
          <rect x="-38" y="-100" width="76" height="200" rx="16" fill="var(--art-accent)" fill-opacity="0.1" stroke="var(--art-accent)" stroke-opacity="0.55" />
          <rect x="-100" y="-38" width="200" height="76" rx="16" fill="var(--art-accent)" fill-opacity="0.1" stroke="var(--art-accent)" stroke-opacity="0.55" />
          <rect x="-24" y="-86" width="48" height="172" fill="var(--art-accent)" fill-opacity="0.12" />
          <rect x="-86" y="-24" width="172" height="48" fill="var(--art-accent)" fill-opacity="0.12" />
        </g>
        <circle cx="320" cy="170" r="148" stroke="var(--art-accent)" stroke-opacity="0.22" stroke-dasharray="4 12" />
        <ellipse cx="320" cy="170" rx="220" ry="190" :fill="glowFill" opacity="0.42" />

        <!-- 心电 -->
        <path class="ecg" d="M18 232h104l18-38 22 76 24-62 20 24h74l18-30 20 52 24-44 18 22h96l20-34 22 60 22-48 18 22h76" stroke="var(--art-accent)" stroke-opacity="0.75" stroke-width="1.6" />
        <path d="M18 232h104l18-38 22 76 24-62 20 24h74l18-30 20 52 24-44 18 22h96l20-34 22 60 22-48 18 22h76" stroke="var(--art-accent)" stroke-opacity="0.12" stroke-width="8" filter="blur(4px)" />

        <!-- 分诊标签 -->
        <g font-family="var(--font-mono)">
          <g v-for="(tag, index) in [{ x: 540, y: 112, label: 'I' }, { x: 570, y: 176, label: 'II' }, { x: 556, y: 244, label: 'III' }, { x: 82, y: 122, label: 'IV' }]" :key="`tag-${index}`">
            <rect :x="tag.x - 15" :y="tag.y - 15" width="30" height="30" rx="6" fill="#ffffff" stroke="var(--art-accent)" stroke-opacity="0.55" />
            <text :x="tag.x" :y="tag.y + 3" text-anchor="middle" font-size="9" fill="var(--art-accent)" opacity="0.9">{{ tag.label }}</text>
          </g>
        </g>

        <!-- 资源占用 -->
        <g transform="translate(28 286)">
          <g v-for="(bar, index) in [42, 68, 54, 82, 36]" :key="`bar-${index}`">
            <rect :x="index * 22" y="0" width="10" height="52" rx="3" fill="var(--art-accent)" fill-opacity="0.1" stroke="var(--art-accent)" stroke-opacity="0.24" />
            <rect :x="index * 22" :y="52 - bar" width="10" :height="bar" rx="3" fill="var(--art-accent)" :fill-opacity="0.28 + index * 0.05" />
          </g>
          <text x="0" y="72" fill="var(--art-accent)" font-family="var(--font-mono)" font-size="7" letter-spacing="1.8" opacity="0.65">CAPACITY / 92%</text>
        </g>

        <g font-family="var(--font-mono)" fill="var(--art-accent)">
          <text x="462" y="80" font-size="8" letter-spacing="1.8" opacity="0.8">TRIAGE / 10 MIN</text>
          <text x="462" y="96" font-size="7" letter-spacing="1.6" opacity="0.55">11 PATIENTS · 4 BEDS</text>
        </g>
        <path d="M0 350H640" :stroke="edgeFill" stroke-opacity="0.28" />
      </g>

      <!-- 价值对齐 ------------------------------------------------------- -->
      <g v-else class="scene scene--alignment">
        <circle cx="320" cy="198" r="132" stroke="var(--art-accent)" stroke-opacity="0.2" stroke-dasharray="4 10" />
        <circle cx="320" cy="198" r="94" stroke="var(--art-accent)" stroke-opacity="0.3" />
        <circle cx="320" cy="198" r="44" :fill="glowFill" opacity="0.7" />
        <circle cx="320" cy="198" r="30" fill="#ffffff" stroke="var(--art-accent)" stroke-opacity="0.75" />
        <circle cx="320" cy="198" r="9" fill="var(--art-accent)" fill-opacity="0.8" />
        <circle cx="320" cy="198" r="17" stroke="var(--art-accent)" stroke-opacity="0.4" />

        <!-- 网络连线 -->
        <g stroke="var(--art-accent)" stroke-opacity="0.34">
          <path d="M320 198 176 108M320 198 464 108M320 198 160 292M320 198 480 292M320 198 320 58M320 198 320 338" />
          <path d="M176 108 108 190M176 108 240 58M464 108 532 190M464 108 400 58M160 292 88 344M160 292 224 348M480 292 552 344M480 292 416 348" stroke-opacity="0.2" />
        </g>
        <g fill="#ffffff" stroke="var(--art-accent)">
          <g v-for="(node, index) in [{ x: 176, y: 108, r: 7 }, { x: 464, y: 108, r: 7 }, { x: 160, y: 292, r: 7 }, { x: 480, y: 292, r: 7 }, { x: 320, y: 58, r: 5 }, { x: 320, y: 338, r: 5 }, { x: 108, y: 190, r: 4 }, { x: 240, y: 58, r: 4 }, { x: 532, y: 190, r: 4 }, { x: 400, y: 58, r: 4 }, { x: 88, y: 344, r: 4 }, { x: 224, y: 348, r: 4 }, { x: 552, y: 344, r: 4 }, { x: 416, y: 348, r: 4 }]" :key="`node-${index}`" :cx="node.x" :cy="node.y" :r="node.r" stroke-opacity="0.6" />
        </g>
        <g fill="var(--art-accent)">
          <circle cx="176" cy="108" r="2.2" />
          <circle cx="464" cy="108" r="2.2" />
          <circle cx="160" cy="292" r="2.2" />
          <circle cx="480" cy="292" r="2.2" />
          <circle cx="320" cy="58" r="1.6" />
          <circle cx="320" cy="338" r="1.6" />
        </g>

        <!-- 提示卡 -->
        <g transform="translate(28 62)">
          <rect width="140" height="76" rx="9" fill="#ffffff" stroke="var(--art-accent)" stroke-opacity="0.35" />
          <rect x="12" y="12" width="54" height="4" rx="2" fill="var(--art-accent)" fill-opacity="0.4" />
          <rect x="12" y="26" width="112" height="3" rx="1.5" fill="var(--art-accent)" fill-opacity="0.28" />
          <rect x="12" y="38" width="88" height="3" rx="1.5" fill="var(--art-accent)" fill-opacity="0.22" />
          <path d="M12 58h8" stroke="var(--art-accent)" stroke-opacity="0.55" stroke-width="2" />
        </g>
        <g transform="translate(474 262)">
          <rect width="138" height="76" rx="9" fill="#ffffff" stroke="var(--art-accent)" stroke-opacity="0.35" />
          <rect x="12" y="12" width="64" height="4" rx="2" fill="var(--art-accent)" fill-opacity="0.4" />
          <rect x="12" y="26" width="112" height="3" rx="1.5" fill="var(--art-accent)" fill-opacity="0.28" />
          <rect x="12" y="38" width="92" height="3" rx="1.5" fill="var(--art-accent)" fill-opacity="0.22" />
          <path d="M12 58h8" stroke="var(--art-accent)" stroke-opacity="0.55" stroke-width="2" />
        </g>

        <g font-family="var(--font-mono)" fill="var(--art-accent)">
          <text x="42" y="344" font-size="7" letter-spacing="1.8" opacity="0.65">FAIRNESS / 0.71</text>
          <text x="462" y="362" font-size="7" letter-spacing="1.8" opacity="0.65">PRIVACY / 0.84</text>
          <text x="270" y="198" text-anchor="middle" font-size="8" letter-spacing="1.6" fill="#14242e">ALIGN</text>
        </g>
        <path d="M0 350H640" :stroke="edgeFill" stroke-opacity="0.28" />
      </g>

      <g opacity="0.5">
        <circle cx="32" cy="34" r="1.2" fill="#4e7f8e" />
        <circle cx="598" cy="52" r="1" fill="#4e7f8e" />
        <circle cx="566" cy="364" r="1.2" fill="#4e7f8e" />
        <circle cx="76" cy="382" r="0.9" fill="#4e7f8e" />
      </g>
    </svg>
    <span class="artwork__grid" aria-hidden="true"></span>
    <span class="artwork__vignette" aria-hidden="true"></span>
    <span class="artwork__scan" aria-hidden="true"></span>
  </div>
</template>

<style scoped>
.artwork {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(var(--art-rgb, 15, 110, 132), 0.12), transparent 62%),
    linear-gradient(180deg, #f8fafb 0%, #eef4f7 58%, #e7eff3 100%);
  color: var(--art-accent, #0f6e84);
  isolation: isolate;
}

.artwork svg {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
}

.artwork__grid {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(rgba(20, 36, 46, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(20, 36, 46, 0.035) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(80% 90% at 50% 45%, black, transparent 88%);
}

.artwork__vignette {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(244, 247, 249, 0.16), transparent 34%, rgba(244, 247, 249, 0.34)),
    radial-gradient(80% 80% at 50% 45%, transparent 42%, rgba(244, 247, 249, 0.28));
}

.artwork__scan {
  position: absolute;
  top: -20%;
  bottom: -20%;
  left: -30%;
  z-index: 4;
  width: 24%;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(15, 110, 132, 0.045), transparent);
  transform: rotate(14deg);
  animation: artwork-scan 9s linear infinite;
}

.trolley-body {
  animation: artwork-drift 6s ease-in-out infinite;
}

.crowd-main {
  animation: artwork-flicker 4.5s ease-in-out infinite;
}

.lever {
  transform-box: fill-box;
  transform-origin: 30% 70%;
  animation: artwork-lever 7s ease-in-out infinite;
}

.rain {
  animation: artwork-rain 3.2s linear infinite;
}

.car {
  animation: artwork-drift 5.2s ease-in-out infinite;
}

.crack {
  stroke-dasharray: 76;
  animation: artwork-crack 5s ease-in-out infinite;
}

.cross {
  animation: artwork-breathe 5.5s ease-in-out infinite;
}

.ecg {
  stroke-dasharray: 120;
  animation: artwork-ecg 5.6s linear infinite;
}

.scene--alignment circle {
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes artwork-scan {
  from {
    transform: translateX(-40%) rotate(14deg);
  }
  to {
    transform: translateX(620%) rotate(14deg);
  }
}

@keyframes artwork-drift {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(-3px, 2px);
  }
}

@keyframes artwork-flicker {
  0%,
  100% {
    opacity: 0.84;
  }
  50% {
    opacity: 1;
  }
}

@keyframes artwork-lever {
  0%,
  42%,
  100% {
    transform: rotate(0deg);
  }
  52%,
  64% {
    transform: rotate(-7deg);
  }
}

@keyframes artwork-rain {
  from {
    transform: translateY(-12px);
  }
  to {
    transform: translateY(18px);
  }
}

@keyframes artwork-crack {
  0%,
  100% {
    stroke-dashoffset: 0;
  }
  55% {
    stroke-dashoffset: 34;
  }
}

@keyframes artwork-breathe {
  0%,
  100% {
    opacity: 0.72;
  }
  50% {
    opacity: 1;
  }
}

@keyframes artwork-ecg {
  from {
    stroke-dashoffset: 120;
  }
  to {
    stroke-dashoffset: -120;
  }
}

@media (prefers-reduced-motion: reduce) {
  .artwork * {
    animation: none !important;
  }
}

.reduce-motion .artwork * {
  animation: none !important;
}
</style>
