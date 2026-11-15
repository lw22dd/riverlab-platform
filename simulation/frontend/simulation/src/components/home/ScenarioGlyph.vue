<script setup lang="ts">
defineProps<{
  kind: 'autonomous' | 'trolley' | 'footbridge' | 'collapse' | 'dujiangyan'
}>()
</script>

<template>
  <div class="glyph" :class="`glyph--${kind}`" aria-hidden="true">
    <svg viewBox="0 0 520 320" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g v-if="kind === 'autonomous'">
        <defs>
          <linearGradient id="auto-fade" x1="260" y1="95" x2="260" y2="320" gradientUnits="userSpaceOnUse">
            <stop stop-color="currentColor" stop-opacity="0.24" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0.01" />
          </linearGradient>
          <linearGradient id="auto-car" x1="250" y1="252" x2="250" y2="306" gradientUnits="userSpaceOnUse">
            <stop stop-color="currentColor" stop-opacity="0.4" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0.06" />
          </linearGradient>
        </defs>

        <path d="M0 214H520" stroke="currentColor" stroke-opacity="0.1" />
        <path d="M0 92H520" stroke="currentColor" stroke-opacity="0.06" stroke-dasharray="2 9" />
        <circle cx="422" cy="72" r="28" fill="currentColor" opacity="0.035" />

        <g class="rain-lines" stroke="currentColor" stroke-opacity="0.2" stroke-width="1">
          <line x1="44" y1="20" x2="38" y2="50" />
          <line x1="92" y1="8" x2="86" y2="38" />
          <line x1="143" y1="28" x2="137" y2="58" />
          <line x1="189" y1="12" x2="183" y2="42" />
          <line x1="338" y1="18" x2="332" y2="48" />
          <line x1="392" y1="34" x2="386" y2="64" />
          <line x1="446" y1="10" x2="440" y2="40" />
          <line x1="488" y1="42" x2="482" y2="72" />
        </g>

        <path d="M202 105 L320 105 L480 320 L40 320Z" fill="currentColor" fill-opacity="0.045" />
        <path d="M202 105 L320 105 L480 320 L40 320Z" stroke="currentColor" stroke-opacity="0.18" />
        <path d="M245 105 L245 320M275 105 L275 320" stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="14 12" />
        <path d="M258 190 L258 320" stroke="currentColor" stroke-opacity="0.16" stroke-dasharray="20 16" />
        <path d="M86 320 L207 105M434 320 L313 105" stroke="currentColor" stroke-opacity="0.28" />

        <g class="crosswalk" stroke="currentColor" stroke-opacity="0.28">
          <path d="M170 218 L350 218" />
          <path d="M175 232 L345 232" />
          <path d="M181 246 L339 246" />
          <path d="M188 260 L332 260" />
          <path d="M196 274 L324 274" />
        </g>

        <g class="truck" opacity="0.58">
          <path d="M323 118 h53 v55 h-53z" fill="currentColor" fill-opacity="0.09" stroke="currentColor" />
          <path d="M331 126 h35 v18 h-35z" fill="currentColor" fill-opacity="0.15" />
          <circle cx="335" cy="177" r="6" fill="currentColor" fill-opacity="0.35" />
          <circle cx="364" cy="177" r="6" fill="currentColor" fill-opacity="0.35" />
          <path d="M318 149 h-12M318 158 h-12" class="headlight" stroke="currentColor" stroke-width="2" />
        </g>

        <g class="children">
          <g>
            <circle cx="363" cy="216" r="5" fill="currentColor" opacity="0.7" />
            <path d="M363 221v18M358 228l-6 9M368 228l6 9M359 239l-4 12M367 239l4 12" stroke="currentColor" />
          </g>
          <g>
            <circle cx="375" cy="224" r="5" fill="currentColor" opacity="0.62" />
            <path d="M375 229v17M370 235l-6 9M380 235l6 9M371 246l-4 12M379 246l4 12" stroke="currentColor" />
          </g>
          <g>
            <circle cx="386" cy="213" r="4.6" fill="currentColor" opacity="0.55" />
            <path d="M386 218v16M381 224l-5 8M391 224l5 8M382 234l-3 11M390 234l3 11" stroke="currentColor" />
          </g>
        </g>

        <g class="sensor-arcs" stroke="currentColor" stroke-opacity="0.38" stroke-dasharray="4 8">
          <ellipse cx="258" cy="249" rx="75" ry="22" />
          <ellipse cx="258" cy="249" rx="108" ry="32" opacity="0.52" />
          <ellipse cx="258" cy="249" rx="145" ry="43" opacity="0.25" />
        </g>

        <g class="car">
          <path d="M216 264c2-14 16-23 42-23s40 9 42 23l7 30H209l7-30Z" fill="url(#auto-car)" stroke="currentColor" />
          <path d="M230 262c4-8 13-13 28-13s24 5 28 13" stroke="currentColor" stroke-opacity="0.6" />
          <path d="M232 270h52l4 13h-60l4-13Z" fill="currentColor" fill-opacity="0.22" />
          <circle cx="224" cy="296" r="6" stroke="currentColor" />
          <circle cx="292" cy="296" r="6" stroke="currentColor" />
          <path d="M244 278h-9M272 278h9" stroke="currentColor" stroke-width="4" class="brake-light" />
          <rect x="250" y="248" width="16" height="8" rx="4" stroke="currentColor" />
          <circle cx="258" cy="243" r="3" fill="currentColor" class="sensor-dot" />
        </g>

        <g class="warning-badge">
          <circle cx="426" cy="222" r="26" stroke="currentColor" stroke-opacity="0.3" />
          <path d="M426 208v18" stroke="currentColor" stroke-width="2" />
          <circle cx="426" cy="234" r="1.8" fill="currentColor" />
          <text x="426" y="264" text-anchor="middle" fill="currentColor" font-size="9" font-family="monospace" opacity="0.65">
            78%
          </text>
        </g>
      </g>

      <g v-else-if="kind === 'trolley'">
        <defs>
          <radialGradient id="trolley-sun" cx="0.5" cy="0.5" r="0.5">
            <stop stop-color="currentColor" stop-opacity="0.22" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle cx="408" cy="76" r="58" fill="url(#trolley-sun)" />
        <circle cx="408" cy="76" r="25" stroke="currentColor" stroke-opacity="0.28" />
        <path d="M0 224H520" stroke="currentColor" stroke-opacity="0.12" />

        <g class="rails" stroke="currentColor">
          <path d="M214 320C228 262 252 214 258 104" stroke-opacity="0.34" />
          <path d="M232 320C242 264 259 216 264 104" stroke-opacity="0.24" />
          <path d="M287 320C301 270 318 232 344 196C370 160 394 134 402 96" stroke-opacity="0.3" />
          <path d="M307 320C319 274 333 238 356 206C380 172 402 142 410 98" stroke-opacity="0.2" />
        </g>
        <g class="sleepers" stroke="currentColor" stroke-opacity="0.2">
          <path d="M186 288h76M194 264h65M205 240h55M218 218h44M232 196h34M243 176h26M250 157h20M254 138h16" />
          <path d="M298 288h90M313 264h67M328 240h55M347 218h46M370 198h38M388 177h28M397 156h18" />
        </g>

        <path d="M226 218C236 206 264 202 280 212" stroke="currentColor" stroke-opacity="0.48" stroke-dasharray="3 6" />
        <g class="lever">
          <path d="M126 252h58l8 16h-74z" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.6" />
          <path d="M150 252l22-58" stroke="currentColor" stroke-width="4" stroke-opacity="0.7" />
          <circle cx="173" cy="190" r="7" fill="currentColor" fill-opacity="0.4" stroke="currentColor" />
          <circle cx="152" cy="251" r="3" fill="currentColor" />
          <path d="M84 268h110" stroke="currentColor" stroke-opacity="0.3" />
        </g>

        <g class="workers-main">
          <circle cx="258" cy="135" r="5" fill="currentColor" opacity="0.8" />
          <circle cx="276" cy="144" r="5" fill="currentColor" opacity="0.7" />
          <circle cx="240" cy="150" r="5" fill="currentColor" opacity="0.6" />
          <circle cx="263" cy="158" r="5" fill="currentColor" opacity="0.55" />
          <circle cx="283" cy="165" r="5" fill="currentColor" opacity="0.42" />
          <path d="M258 140v16M276 149v15M240 155v14M263 163v14M283 170v13" stroke="currentColor" opacity="0.45" />
        </g>
        <g class="worker-side">
          <circle cx="402" cy="150" r="5" fill="currentColor" opacity="0.8" />
          <path d="M402 155v17M397 161l-5 8M407 161l5 8M398 172l-3 12M406 172l3 12" stroke="currentColor" opacity="0.6" />
        </g>
        <g class="counts" font-family="monospace" font-size="10" fill="currentColor">
          <circle cx="222" cy="120" r="12" stroke="currentColor" stroke-opacity="0.28" />
          <text x="222" y="124" text-anchor="middle">5</text>
          <circle cx="430" cy="145" r="12" stroke="currentColor" stroke-opacity="0.28" />
          <text x="430" y="149" text-anchor="middle">1</text>
        </g>

        <g class="trolley" opacity="0.9">
          <path d="M230 250h58v54h-58z" fill="currentColor" fill-opacity="0.11" stroke="currentColor" />
          <path d="M236 236h46l9 18h-64l9-18Z" fill="currentColor" fill-opacity="0.09" stroke="currentColor" />
          <path d="M240 244h38v10h-38z" fill="currentColor" fill-opacity="0.22" />
          <circle cx="242" cy="306" r="5" stroke="currentColor" />
          <circle cx="276" cy="306" r="5" stroke="currentColor" />
          <path d="M239 262h-12M279 262h-12" stroke="currentColor" stroke-width="3" />
          <path d="M292 266c12 0 20-6 22-16" stroke="currentColor" stroke-opacity="0.3" stroke-dasharray="3 6" />
        </g>

        <g class="warning-sign">
          <path d="M441 230l18 32h-36l18-32Z" stroke="currentColor" stroke-opacity="0.44" />
          <path d="M441 240v9" stroke="currentColor" />
          <circle cx="441" cy="254" r="1.4" fill="currentColor" />
        </g>
      </g>

      <g v-else-if="kind === 'footbridge'">
        <defs>
          <radialGradient id="bridge-glow" cx="0.5" cy="0.5" r="0.5">
            <stop stop-color="currentColor" stop-opacity="0.2" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle cx="424" cy="66" r="56" fill="url(#bridge-glow)" />
        <path d="M0 252H520" stroke="currentColor" stroke-opacity="0.12" />

        <g stroke="currentColor">
          <path d="M190 320C214 268 240 212 248 156" stroke-opacity="0.3" />
          <path d="M208 320C226 268 250 214 258 156" stroke-opacity="0.22" />
          <path d="M330 320C306 268 280 212 272 156" stroke-opacity="0.3" />
          <path d="M312 320C294 268 270 214 264 156" stroke-opacity="0.22" />
        </g>
        <g stroke="currentColor" stroke-opacity="0.18">
          <path d="M180 300h80M196 274h68M212 248h56M226 224h44M234 202h34M240 182h26M244 166h20" />
        </g>

        <g>
          <path d="M58 154h404v14H58z" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-opacity="0.5" />
          <path d="M58 154v-26M462 154v-26" stroke="currentColor" stroke-opacity="0.3" />
          <path d="M58 128h404M58 144h404" stroke="currentColor" stroke-opacity="0.35" />
          <g stroke="currentColor" stroke-opacity="0.28">
            <path d="M70 128v40M100 128v40M130 128v40M160 128v40M190 128v40M220 128v40M250 128v40M280 128v40M310 128v40M340 128v40M370 128v40M400 128v40M430 128v40M460 128v40" />
          </g>
          <path d="M120 168v84M400 168v84" stroke="currentColor" stroke-opacity="0.3" />
          <path d="M100 252h40M380 252h40" stroke="currentColor" stroke-opacity="0.3" />
        </g>

        <g class="bridge-figures">
          <circle cx="236" cy="108" r="6" fill="currentColor" opacity="0.8" />
          <path d="M236 114v18M231 120l-9 10M241 120l8 8M232 132l-4 18M240 132l4 18" stroke="currentColor" stroke-width="1.6" opacity="0.7" />
          <circle cx="292" cy="101" r="9" fill="currentColor" opacity="0.5" />
          <path d="M292 110c-13 0-21 8-21 22v16h42v-16c0-14-8-22-21-22Z" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-opacity="0.62" />
          <path d="M278 118l-7 20M306 118l7 18" stroke="currentColor" stroke-opacity="0.5" />
          <path d="M285 148v22M299 148v22" stroke="currentColor" stroke-opacity="0.5" />
        </g>

        <path class="push-arc" d="M251 112c22-11 35-3 39 15" stroke="currentColor" stroke-opacity="0.55" stroke-dasharray="4 6" />

        <g fill="currentColor">
          <circle cx="252" cy="206" r="4" opacity="0.7" />
          <circle cx="264" cy="214" r="4" opacity="0.6" />
          <circle cx="244" cy="220" r="4" opacity="0.55" />
          <circle cx="258" cy="228" r="4" opacity="0.45" />
          <circle cx="271" cy="236" r="4" opacity="0.38" />
        </g>

        <g font-family="monospace" font-size="10" fill="currentColor">
          <circle cx="222" cy="196" r="12" stroke="currentColor" stroke-opacity="0.26" />
          <text x="222" y="200" text-anchor="middle">5</text>
          <circle cx="332" cy="116" r="12" stroke="currentColor" stroke-opacity="0.26" />
          <text x="332" y="120" text-anchor="middle">1</text>
        </g>
      </g>

      <g v-else-if="kind === 'collapse'">
        <defs>
          <linearGradient id="collapse-dust" x1="180" y1="250" x2="180" y2="320" gradientUnits="userSpaceOnUse">
            <stop stop-color="currentColor" stop-opacity="0.15" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 268H520" stroke="currentColor" stroke-opacity="0.14" />
        <path d="M0 286H520" stroke="currentColor" stroke-opacity="0.06" stroke-dasharray="12 12" />

        <g class="school" opacity="0.35">
          <path d="M394 232h82v54h-82z" stroke="currentColor" />
          <path d="M410 248h16v16h-16zM438 248h16v16h-16z" stroke="currentColor" opacity="0.6" />
          <path d="M414 286v-14h42v14" stroke="currentColor" opacity="0.7" />
          <path d="M386 222h96" stroke="currentColor" />
          <text x="435" y="214" text-anchor="middle" fill="currentColor" font-size="8" font-family="monospace" opacity="0.7">
            SCHOOL
          </text>
        </g>

        <g class="scaffold" stroke="currentColor" stroke-opacity="0.2">
          <path d="M120 82v202M168 82v202M216 82v202M264 82v202" />
          <path d="M120 118h144M120 158h144M120 198h144M120 238h144" />
        </g>

        <g class="building" stroke="currentColor">
          <g fill="currentColor" fill-opacity="0.035">
            <path d="M64 74h158v50H64z" />
            <path d="M64 128h158v50H64z" />
            <path d="M64 182h158v50H64z" />
            <path d="M64 236h158v50H64z" />
          </g>
          <path d="M64 74h158v212H64z" stroke-opacity="0.42" />
          <path d="M64 124h158M64 174h158M64 224h158" stroke-opacity="0.22" />
          <g class="windows" fill="currentColor" fill-opacity="0.22">
            <path d="M80 91h22v18H80zM116 91h22v18h-22zM152 91h22v18h-22zM188 91h20v18h-20z" />
            <path d="M80 145h22v18H80zM116 145h22v18h-22zM152 145h22v18h-22zM188 145h20v18h-20z" />
            <path d="M80 199h22v18H80zM116 199h22v18h-22zM152 199h22v18h-22zM188 199h20v18h-20z" />
            <path d="M80 253h22v18H80zM116 253h22v18h-22zM152 253h22v18h-22zM188 253h20v18h-20z" />
          </g>
          <path class="crack-line" d="M216 86l-11 20 14 17-19 20 16 23-11 21 13 18" stroke-width="1.4" stroke-opacity="0.8" />
          <path d="M222 74v212" stroke-opacity="0.5" />
        </g>

        <g class="falling-block" opacity="0.55">
          <path d="M246 118l42-12 18 31-42 15-18-34Z" stroke="currentColor" fill="currentColor" fill-opacity="0.04" />
          <path d="M240 104l-9-15" stroke="currentColor" stroke-dasharray="2 5" />
        </g>

        <g class="guardrail" stroke="currentColor">
          <path d="M296 282h92" stroke-opacity="0.6" />
          <path d="M306 282v-30M336 282v-30M366 282v-30" stroke-opacity="0.34" />
          <path d="M294 252h96M294 264h96" stroke-opacity="0.44" />
          <path d="M298 252h78" class="reflector" stroke-width="2" stroke-opacity="0.8" />
        </g>

        <g class="pit" stroke="currentColor">
          <path d="M292 292h100l18 24H274l18-24Z" stroke-opacity="0.35" />
          <path d="M300 292l-8 24M384 292l8 24" stroke-opacity="0.2" />
          <circle cx="342" cy="286" r="5" fill="currentColor" fill-opacity="0.35" />
        </g>

        <g class="dust" fill="currentColor">
          <circle cx="108" cy="300" r="9" opacity="0.08" />
          <circle cx="134" cy="306" r="14" opacity="0.06" />
          <circle cx="170" cy="299" r="11" opacity="0.07" />
          <circle cx="210" cy="305" r="17" opacity="0.05" />
        </g>
        <path d="M86 300c28-18 56-20 86-12 30 8 60 7 86-3 14-6 28-8 42-6v21H86Z" fill="url(#collapse-dust)" />

        <g class="warning">
          <path d="M453 248l22 39h-44l22-39Z" stroke="currentColor" stroke-opacity="0.5" />
          <path d="M453 260v11" stroke="currentColor" stroke-width="2" />
          <circle cx="453" cy="277" r="1.8" fill="currentColor" />
        </g>

        <g class="kids" opacity="0.5">
          <circle cx="392" cy="251" r="3.5" fill="currentColor" />
          <path d="M392 254v10M389 258l-3 5M395 258l3 5M390 264l-2 7M394 264l2 7" stroke="currentColor" />
          <circle cx="403" cy="256" r="3.5" fill="currentColor" />
          <path d="M403 259v10M400 263l-3 5M406 263l3 5M401 269l-2 7M405 269l2 7" stroke="currentColor" />
        </g>
      </g>

      <g v-else class="scene-dujiangyan">
        <defs>
          <linearGradient id="dujiangyan-sky" x1="260" y1="20" x2="260" y2="230" gradientUnits="userSpaceOnUse">
            <stop stop-color="currentColor" stop-opacity="0.02" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0.1" />
          </linearGradient>
          <linearGradient id="dujiangyan-river" x1="260" y1="120" x2="260" y2="320" gradientUnits="userSpaceOnUse">
            <stop stop-color="currentColor" stop-opacity="0.3" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0.08" />
          </linearGradient>
        </defs>

        <rect x="20" y="20" width="480" height="280" fill="url(#dujiangyan-sky)" rx="12" />
        <circle cx="402" cy="82" r="34" fill="currentColor" opacity="0.05" />
        <circle cx="402" cy="82" r="19" stroke="currentColor" stroke-opacity="0.24" />

        <path d="M22 226 92 116l48 56 44-72 58 82 42-44 68 88Z" fill="currentColor" fill-opacity="0.05" />
        <path d="M22 226 92 116l48 56 44-72 58 82 42-44 68 88" stroke="currentColor" stroke-opacity="0.26" />
        <path d="M166 214v78" stroke="currentColor" stroke-opacity="0.34" stroke-width="2" />
        <path d="M184 214v78" stroke="currentColor" stroke-opacity="0.22" stroke-width="2" />
        <path d="M166 240h18M166 266h18" stroke="currentColor" stroke-opacity="0.16" />

        <path d="M238 28c-8 44-4 74 14 96 16 20 22 38 12 54-8 14-6 26 6 36 12 10 26 24 34 42" stroke="url(#dujiangyan-river)" stroke-width="26" stroke-linecap="round" />
        <path d="M252 52c-2 26 2 44 16 60 12 14 16 26 10 40" stroke="currentColor" stroke-opacity="0.18" stroke-width="1.2" stroke-dasharray="5 9" />

        <path d="M262 178c22 10 50 22 74 52 14 18 26 36 40 58" stroke="currentColor" stroke-opacity="0.22" stroke-width="12" fill="none" stroke-linecap="round" />
        <path d="M240 214c-22 20-42 44-62 76" stroke="currentColor" stroke-opacity="0.18" stroke-width="9" fill="none" stroke-linecap="round" />

        <path d="M250 162c10-6 22-4 28 6 6 10 2 22-8 26-11 5-22 0-25-11-2-8 0-16 5-21Z" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.55" />
        <path d="M252 166c6 6 10 16 10 28" stroke="currentColor" stroke-opacity="0.3" />

        <g fill="none" stroke="currentColor" stroke-opacity="0.2">
          <path d="M70 282h74M70 296h74M70 310h74" />
          <path d="M92 274v46M118 274v46" />
        </g>
        <g fill="currentColor" fill-opacity="0.24">
          <circle cx="120" cy="262" r="3" />
          <circle cx="132" cy="268" r="3" />
          <path d="M120 265v10M132 271v9" stroke="currentColor" stroke-width="1" />
        </g>

        <g font-family="monospace" font-size="9" fill="currentColor" opacity="0.62">
          <text x="270" y="152">鱼嘴</text>
          <text x="184" y="206">宝瓶口</text>
          <text x="104" y="262">成都平原</text>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.glyph {
  width: 100%;
  height: 100%;
  color: var(--accent, #0f6e84);
  /* 将场景强调色压向石板灰，确保线稿在浅色面板上仍然清晰。 */
  color: color-mix(in srgb, var(--accent, #0f6e84) 58%, #14242e);
}

.glyph svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.glyph svg text {
  letter-spacing: 0.1em;
}

.rain-lines line {
  animation: glyph-rain 2.4s linear infinite;
}

.rain-lines line:nth-child(2n) {
  animation-delay: -0.8s;
  animation-duration: 3.1s;
}

.rain-lines line:nth-child(3n) {
  animation-delay: -1.6s;
  animation-duration: 2.7s;
}

.sensor-arcs {
  transform-origin: 258px 249px;
  animation: glyph-sonar 3.4s ease-out infinite;
}

.sensor-dot {
  animation: glyph-blink 1.8s ease-in-out infinite;
}

.brake-light {
  animation: glyph-blink 1.3s ease-in-out infinite;
}

.warning-badge {
  animation: glyph-float 5s ease-in-out infinite;
}

.trolley {
  animation: glyph-drift 5.5s ease-in-out infinite;
}

.lever {
  transform-origin: 152px 252px;
  animation: glyph-lever 5s ease-in-out infinite;
}

.falling-block {
  transform-origin: 266px 120px;
  animation: glyph-fall 6s ease-in-out infinite;
}

.push-arc {
  stroke-dasharray: 4 6;
  animation: glyph-crack 4.5s ease-in-out infinite;
}

.reflector {
  animation: glyph-blink 2.2s ease-in-out infinite;
}

.crack-line {
  stroke-dasharray: 60;
  animation: glyph-crack 4.5s ease-in-out infinite;
}

.kids,
.warning {
  animation: glyph-float 6s ease-in-out infinite;
}

@keyframes glyph-rain {
  from {
    transform: translateY(-14px);
  }
  to {
    transform: translateY(20px);
  }
}

@keyframes glyph-sonar {
  0% {
    opacity: 0.16;
    transform: scale(0.82);
  }
  55% {
    opacity: 0.6;
  }
  100% {
    opacity: 0.16;
    transform: scale(1.04);
  }
}

@keyframes glyph-blink {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 0.18;
  }
}

@keyframes glyph-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@keyframes glyph-drift {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(-3px, 2px);
  }
}

@keyframes glyph-lever {
  0%,
  38%,
  100% {
    transform: rotate(0deg);
  }
  48%,
  62% {
    transform: rotate(-8deg);
  }
}

@keyframes glyph-fall {
  0%,
  42%,
  100% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 0.35;
  }
  68% {
    transform: translate(14px, 54px) rotate(18deg);
    opacity: 0.6;
  }
}

@keyframes glyph-crack {
  0%,
  100% {
    stroke-dashoffset: 0;
  }
  55% {
    stroke-dashoffset: 22;
  }
}

@media (prefers-reduced-motion: reduce) {
  .glyph * {
    animation: none !important;
  }
}
</style>
