/**
 * STAGES CONFIGURATION
 * 
 * Defines the 24 stages of the Pa-Auk meditation path:
 * Samatha -> Jhana -> Vipassana -> Nibbana
 * 
 * Each stage includes realistic meditation duration in minutes.
 * These timings are based on Pa-Auk Sayadaw's teachings where
 * reaching jhana typically requires hours of sustained practice.
 */

export const STAGES = [
    // --- PHASE 1: ANAPANASATI (SAMATHA) ---
    {
        id: 0,
        category: "Samatha: Anapanasati",
        title: "1. Counting",
        pali: "Ganana",
        desc: "Focus on the touching point (Upper Lip). The mind is chaotic ('Monkey Mind'). Count the breaths to anchor attention.",
        factors: ['f-vitakka'], // Applied Thought
        mode: 'SAMATHA_BREATH',
        params: { noise: 0.30, focus: 0.1, nimittaStr: 0.0, nimittaType: 'none', breathVis: 1.0 },
        durationMinutes: 45 // Early meditation, settling the mind
    },
    {
        id: 1,
        category: "Samatha: Anapanasati",
        title: "2. Following",
        pali: "Anubandhana",
        desc: "Drop the counting. Follow the continuous flow of breath at the touching point. The noise subsides.",
        factors: ['f-vitakka', 'f-vicara'], // Applied + Sustained
        mode: 'SAMATHA_BREATH',
        params: { noise: 0.10, focus: 0.4, nimittaStr: 0.0, nimittaType: 'none', breathVis: 0.8 },
        durationMinutes: 35 // Deepening concentration
    },
    {
        id: 2,
        category: "Samatha: Nimitta",
        title: "3. Preparatory Sign",
        pali: "Parikamma-Nimitta",
        desc: "A grey, smoky, or misty form appears. It is unstable and wanders. Do not chase it; keep focus on the breath.",
        factors: ['f-vitakka', 'f-vicara'],
        mode: 'SAMATHA_NIMITTA',
        params: { noise: 0.05, focus: 0.6, nimittaStr: 0.4, nimittaType: 'smoke', breathVis: 0.6 },
        durationMinutes: 25 // Sign appears and develops
    },
    {
        id: 3,
        category: "Samatha: Nimitta",
        title: "4. Learning Sign",
        pali: "Uggaha-Nimitta",
        desc: "The sign solidifies. It becomes white and opaque (like cotton, plaster, or a pearl). It is stable.",
        factors: ['f-vitakka', 'f-vicara', 'f-piti'], // Joy arises
        mode: 'SAMATHA_NIMITTA',
        params: { noise: 0.00, focus: 0.8, nimittaStr: 0.9, nimittaType: 'cotton', breathVis: 0.4 },
        durationMinutes: 30 // Stabilizing the sign
    },
    {
        id: 4,
        category: "Samatha: Nimitta",
        title: "5. Counterpart Sign",
        pali: "Patibhaga-Nimitta",
        desc: "The texture falls away. The sign becomes transparent, radiant, and brilliant (like the morning star or crystal).",
        factors: ['f-vitakka', 'f-vicara', 'f-piti', 'f-sukha', 'f-ekaggata'], // All 5 factors
        mode: 'SAMATHA_NIMITTA',
        params: { noise: 0.00, focus: 1.0, nimittaStr: 1.0, nimittaType: 'crystal', breathVis: 0.1 },
        durationMinutes: 25 // Approaching absorption
    },
    
    // --- PHASE 2: RUPA JHANA (ABSORPTION) ---
    {
        id: 5,
        category: "Rupa Jhana",
        title: "6. First Jhana",
        pali: "Pathama Jhana",
        desc: "Full Absorption. The mind merges with the Patibhaga Nimitta. Perception of the body and breath ceases.",
        factors: ['f-vitakka', 'f-vicara', 'f-piti', 'f-sukha', 'f-ekaggata'],
        mode: 'JHANA',
        params: { level: 1, color: '#fffdd0' }, // Creamy white
        durationMinutes: 45 // First jhana absorption
    },
    {
        id: 6,
        category: "Rupa Jhana",
        title: "7. Second Jhana",
        pali: "Dutiya Jhana",
        desc: "Vitakka and Vicara subside. Confidence and Rapture (Piti) become dominant.",
        factors: ['f-piti', 'f-sukha', 'f-ekaggata'],
        mode: 'JHANA',
        params: { level: 2, color: '#fff' },
        durationMinutes: 35 // Deeper absorption
    },
    {
        id: 7,
        category: "Rupa Jhana",
        title: "8. Third Jhana",
        pali: "Tatiya Jhana",
        desc: "Piti fades away. Only Sukha (Bliss) and One-pointedness remain.",
        factors: ['f-sukha', 'f-ekaggata'],
        mode: 'JHANA',
        params: { level: 3, color: '#ffffff' },
        durationMinutes: 30 // Refined absorption
    },
    {
        id: 8,
        category: "Rupa Jhana",
        title: "9. Fourth Jhana",
        pali: "Catuttha Jhana",
        desc: "Pure Equanimity (Upekkha) and One-pointedness. The light is brilliant, still, and white.",
        factors: ['f-ekaggata', 'f-upekkha'],
        mode: 'JHANA',
        params: { level: 4, color: '#ffffff' },
        durationMinutes: 40 // Peak form absorption
    },
    {
        id: 9,
        category: "Jhana Mastery",
        title: "10. Discerning Jhana Factors",
        pali: "Jhana Paccavekkhana",
        desc: "Emerge from Fourth Jhana. Direct attention to the Heart Base (Hadaya Vatthu). Clearly discern the Jhana factors present: Ekaggata and Upekkha. This is the Fifth Mastery (Paccavekkhana Vasi).",
        factors: ['f-ekaggata', 'f-upekkha'],
        mode: 'JHANA_FACTORS_HEARTBASE',
        params: { jhanaLevel: 4 },
        durationMinutes: 20 // Review and discernment
    },

    // --- PHASE 3: ARUPA JHANA (IMMATERIAL) ---
    {
        id: 11,
        category: "Arupa Jhana",
        title: "12. Infinite Space",
        pali: "Akasanancayatana",
        desc: "Extend the nimitta to the universe, then remove it. Focus on the infinite space left behind.",
        factors: ['f-ekaggata', 'f-upekkha'],
        mode: 'ARUPA',
        params: { subType: 'space' },
        durationMinutes: 30 // First formless absorption
    },
    {
        id: 12,
        category: "Arupa Jhana",
        title: "13. Infinite Consciousness",
        pali: "Vinnanancayatana",
        desc: "Focus on the consciousness that perceived the infinite space. 'Knowing, knowing'.",
        factors: ['f-ekaggata', 'f-upekkha'],
        mode: 'ARUPA',
        params: { subType: 'consciousness' },
        durationMinutes: 25 // Consciousness absorption
    },
    {
        id: 13,
        category: "Arupa Jhana",
        title: "14. Nothingness",
        pali: "Akincannayatana",
        desc: "Focus on the absence of the previous consciousness. 'There is nothing'.",
        factors: ['f-ekaggata', 'f-upekkha'],
        mode: 'ARUPA',
        params: { subType: 'nothing' },
        durationMinutes: 25 // Nothingness absorption
    },
    {
        id: 14,
        category: "Arupa Jhana",
        title: "15. Neither-Perception",
        pali: "Nevasannanasannayatana",
        desc: "The perception is so subtle it cannot be said to exist or not exist.",
        factors: ['f-ekaggata', 'f-upekkha'],
        mode: 'ARUPA',
        params: { subType: 'neither' },
        durationMinutes: 20 // Subtlest formless absorption
    },

    // --- PHASE 4: VIPASSANA (MATERIALITY) ---
    {
        id: 15,
        category: "Vipassana: Rupa",
        title: "16. Four Elements Analysis",
        pali: "Catudhatu-vavatthana",
        desc: "Emerging from Jhana, analyze the 'solid' light. It breaks into clusters (Rupa Kalapas). Discern Earth, Water, Fire, Wind.",
        factors: ['f-ekaggata'],
        mode: 'VIPASSANA_RUPA',
        params: { chaos: 0.2 },
        durationMinutes: 20 // Element analysis
    },

    // --- PHASE 5: VIPASSANA (MENTALITY) ---
    {
        id: 16,
        category: "Vipassana: Nama",
        title: "17. Mentality Analysis",
        pali: "Nama-Pariggaha",
        desc: "Discern the Cognitive Process (Vithi). See the Mind Moments (Cittas) arising from the Heart Base.",
        factors: ['f-ekaggata'],
        mode: 'VIPASSANA_NAMA',
        params: {},
        durationMinutes: 20 // Mind analysis
    },

    // --- PHASE 6: DEPENDENT ORIGINATION ---
    {
        id: 17,
        category: "Dependent Origination",
        title: "18. Past Lives",
        pali: "Paccaya-Pariggaha (Past)",
        desc: "Trace the causal chain backwards. See the Death Moment of the past life causing the Rebirth of this life.",
        factors: ['f-ekaggata'],
        mode: 'TIME_TUNNEL',
        params: { dir: -1, speed: 2.0 },
        durationMinutes: 15 // Past life investigation
    },
    {
        id: 18,
        category: "Dependent Origination",
        title: "19. Future Lives",
        pali: "Anagata-amsa",
        desc: "Trace the chain forwards. See future births driven by remaining craving until the cessation of Ignorance.",
        factors: ['f-ekaggata'],
        mode: 'TIME_TUNNEL',
        params: { dir: 1, speed: 3.0 },
        durationMinutes: 15 // Future life investigation
    },

    // --- PHASE 7: VIPASSANA NANAS (INSIGHT) ---
    {
        id: 19,
        category: "Insight Knowledge",
        title: "20. Rise & Fall",
        pali: "Udayabbaya Nana",
        desc: "Seeing the rapid birth and death of all formations. Particles flicker with golden brilliance (Upakkilesa).",
        factors: ['f-ekaggata'],
        mode: 'NANA_RISEFALL',
        params: { flicker: 0.9, color: '#ffd700' },
        durationMinutes: 12 // Insight into arising and passing
    },
    {
        id: 20,
        category: "Insight Knowledge",
        title: "21. Dissolution",
        pali: "Bhanga Nana",
        desc: "The arising phase is no longer seen. Only destruction. Formations vanish into the void.",
        factors: ['f-ekaggata'],
        mode: 'NANA_DISSOLUTION',
        params: { decay: 0.95 },
        durationMinutes: 10 // Insight into dissolution
    },
    {
        id: 21,
        category: "Insight Knowledge",
        title: "22. Terror",
        pali: "Bhaya Nana",
        desc: "Fear arises seeing the constant destruction. The world appears as a burning pit. No safety.",
        factors: ['f-ekaggata'],
        mode: 'NANA_TERROR',
        params: { shake: true, tint: '#500' },
        durationMinutes: 8 // Terror knowledge (typically brief)
    },
    {
        id: 22,
        category: "Insight Knowledge",
        title: "23. Equanimity",
        pali: "Sankharupekkha Nana",
        desc: "The mind accepts impermanence without reaction. Smooth, detached observation of the flow.",
        factors: ['f-ekaggata', 'f-upekkha'],
        mode: 'NANA_EQUANIMITY',
        params: { smooth: true },
        durationMinutes: 15 // Equanimity towards formations
    },
    
    // --- PHASE 8: MAGGA PHALA ---
    {
        id: 23,
        category: "Realization",
        title: "24. Cessation",
        pali: "Nibbana",
        desc: "The mind turns away from the conditioned field. Change of Lineage. Cessation of Name and Form. Peace.",
        factors: [],
        mode: 'NIBBANA',
        params: {},
        durationMinutes: 5 // The moment of cessation (brief but profound)
    }
];

/**
 * Calculate total meditation time in minutes
 */
export function getTotalMeditationTime() {
    return STAGES.reduce((total, stage) => total + (stage.durationMinutes || 0), 0);
}
