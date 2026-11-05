/**
 * Generates custom collectible holographic trading card artwork (data URLs)
 * for each South Asian commercial freight corridor.
 */

export interface CorridorCardSpec {
  id: string
  title: string
  highway: string
  classType: string
  hp: string
  distance: string
  hazard: string
  powerStat: string
  defenseStat: string
  description: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  preset: 'bursts' | 'stars' | 'shards' | 'cosmos' | 'rainbow' | 'swirl' | 'glitter' | 'gold'
  foilColor: string
}

export const CORRIDOR_SPECS: Record<string, CorridorCardSpec> = {
  'Mumbai ➔ Delhi': {
    id: 'mumbai-delhi',
    title: 'NH48 WESTERN EXPRESS',
    highway: 'National Highway 48',
    classType: 'GOLDEN QUADRILATERAL',
    hp: '42K LB ⚡',
    distance: '1,420 KM • 882 MI',
    hazard: 'Coastal Crosswinds & Desert Heat',
    powerStat: 'HAUL POWER 98',
    defenseStat: 'WIND SHIELD 88',
    description: 'Premier multi-lane arterial connecting Jawaharlal Nehru Port with the capital NCR logistics hub.',
    primaryColor: '#facc15',
    secondaryColor: '#ca8a04',
    accentColor: '#1e293b',
    preset: 'gold',
    foilColor: '#facc15',
  },
  'Delhi ➔ Kolkata': {
    id: 'delhi-kolkata',
    title: 'NH19 GRAND TRUNK',
    highway: 'National Highway 19',
    classType: 'HISTORIC FREIGHT ARTERY',
    hp: '38K LB 🛡️',
    distance: '1,510 KM • 938 MI',
    hazard: 'Gangetic Fog & Monsoon Deluges',
    powerStat: 'ENDURANCE 95',
    defenseStat: 'RAIN SHIELD 90',
    description: 'High-density eastern freight artery traversing Uttar Pradesh, Bihar, and the Bengal industrial belt.',
    primaryColor: '#fb923c',
    secondaryColor: '#c2410c',
    accentColor: '#0f172a',
    preset: 'bursts',
    foilColor: '#fdba74',
  },
  'Bengaluru ➔ Chennai': {
    id: 'bengaluru-chennai',
    title: 'INDUSTRIAL EXPRESSWAY',
    highway: 'NH48 South Corridor',
    classType: 'TECH & AUTO CORRIDOR',
    hp: '45K LB ⚙️',
    distance: '345 KM • 214 MI',
    hazard: 'Bay of Bengal Cyclonic Shears',
    powerStat: 'SPEED 99',
    defenseStat: 'STABILITY 94',
    description: 'Rapid freight corridor linking the silicon plateau with Chennai international maritime terminals.',
    primaryColor: '#a855f7',
    secondaryColor: '#7e22ce',
    accentColor: '#1e1b4b',
    preset: 'cosmos',
    foilColor: '#d8b4fe',
  },
  'Delhi ➔ Srinagar': {
    id: 'delhi-srinagar',
    title: 'NH44 HIMALAYAN PASS',
    highway: 'National Highway 44',
    classType: 'MOUNTAIN PASS SPECIAL',
    hp: '30K LB ❄️',
    distance: '810 KM • 503 MI',
    hazard: 'Sub-Zero Freeze & Snow Accumulation',
    powerStat: 'CLIMB TORQUE 92',
    defenseStat: 'ICE TRACTION 96',
    description: 'Challenging high-altitude route crossing the Pir Panjal mountain range with severe snow risk.',
    primaryColor: '#38bdf8',
    secondaryColor: '#0284c7',
    accentColor: '#0c4a6e',
    preset: 'shards',
    foilColor: '#bae6fd',
  },
  'Pune ➔ Hyderabad': {
    id: 'pune-hyderabad',
    title: 'NH65 DECCAN HAUL',
    highway: 'National Highway 65',
    classType: 'PLATEAU COMMERCE ROUTE',
    hp: '40K LB 🚛',
    distance: '560 KM • 348 MI',
    hazard: 'Thermal Gradients & Cross-Ghat Winds',
    powerStat: 'EFFICIENCY 94',
    defenseStat: 'HEAT TOLERANCE 91',
    description: 'Connects the manufacturing complexes of Western Maharashtra with Telangana tech hubs.',
    primaryColor: '#34d399',
    secondaryColor: '#059669',
    accentColor: '#064e3b',
    preset: 'swirl',
    foilColor: '#a7f3d0',
  },
}

export function generateCorridorCardSvg(spec: CorridorCardSpec): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 880" width="630" height="880">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="${spec.primaryColor}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${spec.secondaryColor}" stop-opacity="0.45"/>
    </linearGradient>
    <radialGradient id="sunGlow" cx="50%" cy="35%" r="60%">
      <stop offset="0%" stop-color="${spec.primaryColor}" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="${spec.secondaryColor}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95"/>
    </radialGradient>
  </defs>

  <!-- Card Border & Outer Rim -->
  <rect width="630" height="880" rx="36" fill="${spec.secondaryColor}"/>
  <rect x="20" y="20" width="590" height="840" rx="24" fill="url(#cardBg)" stroke="#ffffff" stroke-width="4"/>

  <!-- Card Top Header -->
  <rect x="42" y="48" width="546" height="56" rx="12" fill="#0f172a" stroke="${spec.primaryColor}" stroke-width="2.5"/>
  <text x="64" y="85" font-family="-apple-system, Inter, sans-serif" font-size="22" font-weight="900" fill="#ffffff" letter-spacing="1">
    ${spec.title}
  </text>
  <text x="450" y="85" font-family="-apple-system, Inter, sans-serif" font-size="20" font-weight="900" fill="${spec.primaryColor}">
    ${spec.hp}
  </text>

  <!-- Illustration Viewport Frame -->
  <rect x="42" y="118" width="546" height="370" rx="16" fill="url(#sunGlow)" stroke="${spec.secondaryColor}" stroke-width="4"/>

  <!-- Stylized Highway Horizon & Mountains -->
  <polygon points="42,420 180,240 330,340 460,200 588,380 588,488 42,488" fill="#1e293b" opacity="0.6"/>
  <polygon points="42,488 280,310 350,310 588,488" fill="#0f172a" opacity="0.8"/>
  
  <!-- Highway Centerline -->
  <polygon points="310,315 320,315 335,488 295,488" fill="${spec.primaryColor}" opacity="0.95"/>

  <!-- Semi-Truck Silhouette -->
  <!-- Cab -->
  <rect x="235" y="270" width="160" height="150" rx="14" fill="#0f172a" stroke="${spec.primaryColor}" stroke-width="4"/>
  <!-- Windshield -->
  <polygon points="255,290 375,290 385,340 245,340" fill="#bae6fd" opacity="0.85" stroke="#0f172a" stroke-width="2"/>
  <!-- Grille -->
  <rect x="260" y="355" width="110" height="48" rx="6" fill="#334155" stroke="${spec.primaryColor}" stroke-width="3"/>
  <line x1="275" y1="365" x2="355" y2="365" stroke="${spec.primaryColor}" stroke-width="2"/>
  <line x1="275" y1="375" x2="355" y2="375" stroke="${spec.primaryColor}" stroke-width="2"/>
  <line x1="275" y1="385" x2="355" y2="385" stroke="${spec.primaryColor}" stroke-width="2"/>
  <!-- Headlights -->
  <circle cx="250" cy="378" r="10" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
  <circle cx="380" cy="378" r="10" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
  <!-- Roof Spoiler / Air Deflector -->
  <polygon points="250,270 380,270 365,245 265,245" fill="${spec.secondaryColor}" stroke="#0f172a" stroke-width="3"/>

  <!-- Badge Banner -->
  <rect x="70" y="455" width="490" height="44" rx="10" fill="#0f172a" stroke="#ffffff" stroke-width="2"/>
  <text x="315" y="483" text-anchor="middle" font-family="-apple-system, Inter, sans-serif" font-size="16" font-weight="800" fill="#f8fafc">
    ${spec.classType} • ${spec.distance}
  </text>

  <!-- Route Specs Info Box -->
  <rect x="42" y="515" width="546" height="52" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <text x="64" y="546" font-family="-apple-system, Inter, sans-serif" font-size="15" font-weight="700" fill="#475569">
    Primary Hazard: <tspan fill="#dc2626" font-weight="800">${spec.hazard}</tspan>
  </text>

  <!-- Power & Description Box -->
  <rect x="42" y="580" width="546" height="175" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <text x="64" y="620" font-family="-apple-system, Inter, sans-serif" font-size="20" font-weight="900" fill="#0f172a">
    ${spec.powerStat}
  </text>
  <text x="360" y="620" font-family="-apple-system, Inter, sans-serif" font-size="20" font-weight="900" fill="${spec.secondaryColor}">
    ${spec.defenseStat}
  </text>
  <text x="64" y="662" font-family="-apple-system, Inter, sans-serif" font-size="15" fill="#334155" width="500">
    ${spec.description}
  </text>
  <text x="64" y="725" font-family="-apple-system, Inter, sans-serif" font-size="13" font-weight="700" fill="${spec.secondaryColor}">
    ★ Weather-Aware Freight Card • South Asia Logistics Fleet Grade
  </text>

  <!-- Bottom Metadata -->
  <text x="64" y="805" font-family="-apple-system, Inter, sans-serif" font-size="14" font-weight="700" fill="#475569">
    Official Route Pass • Open-Meteo &amp; ORS Certified • 2026
  </text>
</svg>
`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
