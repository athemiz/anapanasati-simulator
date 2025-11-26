/**
 * PA-AUK SAYADAW MEDITATION SIMULATOR - "THE VISUDDHIMAGGA ENGINE"
 * 
 * Optimized for 60 FPS with GPU-accelerated canvas operations.
 * Features branching path after Fourth Jhana.
 */

import { STAGES, getTotalMeditationTime } from '../config/stages.js';

export class PaAukEngine {
    constructor(mode = 'manual', timeAcceleration = 120) {
        this.canvas = document.getElementById('simCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.cx = this.width / 2;
        this.cy = this.height / 2;

        // Mode configuration
        this.mode = mode;
        this.timeAcceleration = timeAcceleration;
        
        // Path choice: 'arupa' or 'vipassana'
        this.chosenPath = null;
        this.awaitingPathChoice = false;

        this.state = {
            stageIndex: 0,
            time: 0,
            breathPhase: 0,
            meditationTime: 0,
            stageTime: 0,
            stageProgress: 0,
            isPaused: false,
            isTransitioning: false,
            transitionProgress: 0,
            previousStageIndex: 0
        };

        // Transition duration in real seconds
        this.transitionDuration = 5;

        // Pre-generate noise textures for performance
        this.noiseCanvas = document.createElement('canvas');
        this.noiseCtx = this.noiseCanvas.getContext('2d');
        this.noiseCanvas.width = 256;
        this.noiseCanvas.height = 256;
        this.generateNoiseTextures();

        this.particles = [];
        this.initParticles(2000);

        // Wisp positions (pre-calculated for smooth movement)
        this.wisps = [];
        for (let i = 0; i < 30; i++) {
            this.wisps.push({
                x: Math.random() * 2 - 1,
                y: Math.random() * 2 - 1,
                size: 50 + Math.random() * 150,
                speed: 0.1 + Math.random() * 0.2,
                phase: Math.random() * Math.PI * 2,
                hue: Math.random() * 60 - 30, // -30 to 30 (purples to blues)
                saturation: 20 + Math.random() * 40
            });
        }

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Bind UI
        this.bindUI();

        this.updateUI();
        this.lastFrameTime = performance.now();
        this.loop();
    }

    bindUI() {
        if (this.mode === 'manual') {
            document.getElementById('btn-next').onclick = () => this.handleNext();
            document.getElementById('btn-prev').onclick = () => this.changeStage(-1);
            document.getElementById('manual-controls').style.display = 'flex';
            document.getElementById('realtime-controls').style.display = 'none';
        } else {
            document.getElementById('manual-controls').style.display = 'none';
            document.getElementById('realtime-controls').style.display = 'flex';
            document.getElementById('meditation-timer').style.display = 'block';
            document.getElementById('stage-time').style.display = 'block';
            document.getElementById('timer-speed').innerText = `${this.timeAcceleration}× speed`;
            
            document.getElementById('btn-pause').onclick = () => this.togglePause();
            document.getElementById('btn-exit').onclick = () => this.exitToMenu();
        }

        // Path choice buttons
        document.getElementById('path-arupa').onclick = () => this.selectPath('arupa');
        document.getElementById('path-vipassana').onclick = () => this.selectPath('vipassana');
    }

    generateNoiseTextures() {
        // Generate multiple noise patterns for variety
        const ctx = this.noiseCtx;
        const w = this.noiseCanvas.width;
        const h = this.noiseCanvas.height;
        
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = Math.random();
            // Vary colors: purples, blues, warm spots
            const colorType = Math.random();
            if (colorType < 0.3) {
                // Purple/violet
                data[i] = noise * 80 + 20;
                data[i + 1] = noise * 40;
                data[i + 2] = noise * 100 + 30;
            } else if (colorType < 0.6) {
                // Blue/cyan
                data[i] = noise * 40;
                data[i + 1] = noise * 60 + 20;
                data[i + 2] = noise * 90 + 40;
            } else if (colorType < 0.85) {
                // Gray
                const g = noise * 60 + 10;
                data[i] = g;
                data[i + 1] = g;
                data[i + 2] = g;
            } else {
                // Warm spots (orange/red)
                data[i] = noise * 100 + 40;
                data[i + 1] = noise * 50 + 20;
                data[i + 2] = noise * 30;
            }
            data[i + 3] = 255;
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.cx = this.width / 2;
        this.cy = this.height / 2;
    }

    initParticles(count) {
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                z: Math.random() * 1000,
                vx: (Math.random() - 0.5),
                vy: (Math.random() - 0.5),
                life: Math.random(),
                size: Math.random() * 2 + 0.5,
                type: Math.floor(Math.random() * 4),
                hue: Math.random() * 360
            });
        }
    }

    togglePause() {
        this.state.isPaused = !this.state.isPaused;
        const btn = document.getElementById('btn-pause');
        btn.innerText = this.state.isPaused ? 'Resume' : 'Pause';
        btn.classList.toggle('paused', this.state.isPaused);
    }

    exitToMenu() {
        this.state.isPaused = true;
        document.getElementById('viewport').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
        document.getElementById('path-choice-modal').style.display = 'none';
        this.state.stageIndex = 0;
        this.state.meditationTime = 0;
        this.state.stageTime = 0;
        this.chosenPath = null;
        this.awaitingPathChoice = false;
    }

    // Check if current stage is Fourth Jhana
    isFourthJhana() {
        return STAGES[this.state.stageIndex].id === 8;
    }

    // Get the index of Jhana Factors stage (start of Vipassana path)
    getJhanaFactorsIndex() {
        return STAGES.findIndex(s => s.mode === 'JHANA_FACTORS_HEARTBASE');
    }

    // Get the index of first Arupa Jhana
    getFirstArupaIndex() {
        return STAGES.findIndex(s => s.mode === 'ARUPA');
    }

    handleNext() {
        // Check if we're at Fourth Jhana and need to show path choice
        if (this.isFourthJhana() && !this.chosenPath) {
            this.showPathChoice();
            return;
        }
        this.changeStage(1);
    }

    showPathChoice() {
        this.awaitingPathChoice = true;
        this.state.isPaused = true;
        document.getElementById('path-choice-modal').style.display = 'flex';
    }

    selectPath(path) {
        this.chosenPath = path;
        this.awaitingPathChoice = false;
        this.state.isPaused = false;
        document.getElementById('path-choice-modal').style.display = 'none';

        if (path === 'arupa') {
            // Continue to Arupa Jhanas (next stage after 4th Jhana)
            this.changeStage(1);
        } else {
            // Skip to Jhana Factors (Vipassana)
            const jhanaFactorsIdx = this.getJhanaFactorsIndex();
            if (jhanaFactorsIdx > this.state.stageIndex) {
                this.state.previousStageIndex = this.state.stageIndex;
                this.state.stageIndex = jhanaFactorsIdx;
                this.state.stageTime = 0;
                this.state.stageProgress = 0;
                this.state.isTransitioning = true;
                this.state.transitionProgress = 0;
                this.updateUI();
            }
        }
    }

    changeStage(dir) {
        let next = this.state.stageIndex + dir;
        
        // Handle path branching in real-time mode
        if (this.mode === 'realtime' && dir > 0) {
            // At Fourth Jhana, show choice
            if (this.isFourthJhana() && !this.chosenPath) {
                this.showPathChoice();
                return;
            }
            
            // If we chose vipassana path and just finished 4th jhana, skip arupa
            if (this.chosenPath === 'vipassana' && this.isFourthJhana()) {
                next = this.getJhanaFactorsIndex();
            }
        }

        if (next >= 0 && next < STAGES.length) {
            this.state.previousStageIndex = this.state.stageIndex;
            this.state.stageIndex = next;
            this.state.stageTime = 0;
            this.state.stageProgress = 0;
            this.state.isTransitioning = true;
            this.state.transitionProgress = 0;
            
            if (STAGES[next].mode === 'NIBBANA') {
                const f = document.getElementById('flash-overlay');
                f.style.opacity = 1;
                setTimeout(() => f.style.opacity = 0, 2000);
            }

            this.updateUI();
        }
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    smoothstep(t) {
        return t * t * (3 - 2 * t);
    }

    getBlendedParams(prevStage, nextStage, t) {
        const prevParams = prevStage.params;
        const nextParams = nextStage.params;
        const blended = {};

        const numericKeys = ['noise', 'focus', 'nimittaStr', 'breathVis', 'level', 'chaos', 'flicker', 'decay', 'speed', 'dir', 'greyEmergence'];
        
        for (const key of numericKeys) {
            const prevVal = prevParams[key] !== undefined ? prevParams[key] : 0;
            const nextVal = nextParams[key] !== undefined ? nextParams[key] : 0;
            blended[key] = this.lerp(prevVal, nextVal, t);
        }

        if (prevParams.color || nextParams.color) {
            blended.color = t < 0.5 ? (prevParams.color || '#fff') : (nextParams.color || '#fff');
        }

        blended.nimittaType = t < 0.5 ? (prevParams.nimittaType || 'clouds') : (nextParams.nimittaType || 'clouds');
        blended.subType = t < 0.5 ? prevParams.subType : nextParams.subType;
        blended.shake = t > 0.5 ? nextParams.shake : prevParams.shake;

        return blended;
    }

    updateUI() {
        const s = STAGES[this.state.stageIndex];
        
        document.getElementById('stage-cat').innerText = s.category;
        document.getElementById('stage-title').innerText = s.title;
        document.getElementById('stage-pali').innerText = s.pali;
        document.getElementById('stage-desc').innerText = s.desc;

        const pct = (this.state.stageIndex / (STAGES.length - 1)) * 100;
        document.getElementById('progress-fill').style.width = pct + '%';

        document.querySelectorAll('.factor-chip').forEach(el => el.classList.remove('active'));
        s.factors.forEach(fid => {
            const el = document.getElementById(fid);
            if (el) el.classList.add('active');
        });

        if (this.mode === 'manual') {
            document.getElementById('btn-prev').disabled = this.state.stageIndex === 0;
            document.getElementById('btn-next').disabled = this.state.stageIndex === STAGES.length - 1;
        }

        const v = document.getElementById('vignette');
        if (s.mode === 'JHANA') v.style.background = 'radial-gradient(circle, transparent 10%, #000 120%)';
        else if (s.mode === 'ARUPA') v.style.background = 'radial-gradient(circle, transparent 0%, #000 100%)';
        else v.style.background = 'radial-gradient(circle, transparent 30%, #000 110%)';
    }

    updateTimer() {
        const totalSeconds = Math.floor(this.state.meditationTime);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        document.getElementById('timer-value').innerText = 
            `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        const currentStage = STAGES[this.state.stageIndex];
        const stageDurationSeconds = (currentStage.durationMinutes || 1) * 60;
        const stageProgress = Math.min(100, (this.state.stageTime / stageDurationSeconds) * 100);
        document.getElementById('stage-time-fill').style.width = stageProgress + '%';
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        
        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        // Cap delta to prevent huge jumps
        const cappedDelta = Math.min(deltaTime, 0.05);

        this.state.time += cappedDelta;

        // Don't update if awaiting path choice
        if (this.awaitingPathChoice) return;

        // Real-time mode updates
        if (this.mode === 'realtime' && !this.state.isPaused) {
            const acceleratedDelta = cappedDelta * this.timeAcceleration;
            this.state.meditationTime += acceleratedDelta;
            this.state.stageTime += acceleratedDelta;

            const currentStage = STAGES[this.state.stageIndex];
            const stageDurationSeconds = (currentStage.durationMinutes || 1) * 60;
            this.state.stageProgress = Math.min(1, this.state.stageTime / stageDurationSeconds);

            if (this.state.stageTime >= stageDurationSeconds && this.state.stageIndex < STAGES.length - 1) {
                this.changeStage(1);
            }

            this.updateTimer();
        }

        // Update transition
        if (this.state.isTransitioning) {
            this.state.transitionProgress += cappedDelta;
            if (this.state.transitionProgress >= this.transitionDuration) {
                this.state.isTransitioning = false;
            }
        }

        // Breath
        const currentStage = STAGES[this.state.stageIndex];
        const breathVis = currentStage.params.breathVis || 0;
        if (breathVis > 0.01) {
            const freq = (currentStage.params.noise > 0.3) ? 0.08 : 0.04;
            this.state.breathPhase += freq;
            const bVal = (Math.sin(this.state.breathPhase) + 1) / 2;
            document.getElementById('breath-val').style.height = (bVal * 100) + '%';
        } else {
            document.getElementById('breath-val').style.height = '0%';
        }

        this.render();
    }

    render() {
        const currentStage = STAGES[this.state.stageIndex];
        const previousStage = STAGES[this.state.previousStageIndex];

        let blendFactor = 1;
        if (this.state.isTransitioning) {
            blendFactor = this.smoothstep(Math.min(1, this.state.transitionProgress / this.transitionDuration));
        }

        let renderParams;
        if (this.state.isTransitioning && this.state.previousStageIndex !== this.state.stageIndex) {
            renderParams = this.getBlendedParams(previousStage, currentStage, blendFactor);
        } else {
            renderParams = { ...currentStage.params, transition: null };
        }

        // Clear
        this.ctx.globalCompositeOperation = 'source-over';
        
        if (currentStage.mode === 'NIBBANA' && blendFactor > 0.9) {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.width, this.height);
            return;
        }

        // Background
        if (currentStage.mode === 'NANA_TERROR' && blendFactor > 0.5) {
            this.ctx.fillStyle = '#1a0505';
        } else {
            this.ctx.fillStyle = '#020202';
        }
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(this.cx, this.cy);

        if (renderParams.shake && blendFactor > 0.5) {
            const mag = 5 * blendFactor;
            this.ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
        }

        // Render
        if (this.state.isTransitioning && previousStage.mode !== currentStage.mode) {
            this.renderBlended(previousStage, currentStage, renderParams, blendFactor);
        } else {
            this.renderStage(currentStage, renderParams);
        }

        this.ctx.restore();
    }

    renderBlended(prevStage, nextStage, params, blend) {
        // Special case: SAMATHA_BREATH to SAMATHA_NIMITTA transition
        // These share the same visual field base, so don't double-render
        // Instead, just render with interpolated params
        if (prevStage.mode === 'SAMATHA_BREATH' && nextStage.mode === 'SAMATHA_NIMITTA') {
            // Render the nimitta stage with blended params - it includes the base visual field
            this.renderStage(nextStage, params);
            return;
        }
        
        // Special case: SAMATHA_NIMITTA to SAMATHA_NIMITTA (between nimitta types)
        // Render both within a single nimitta pass using transition info
        if (prevStage.mode === 'SAMATHA_NIMITTA' && nextStage.mode === 'SAMATHA_NIMITTA') {
            const transition = {
                fromType: prevStage.params.nimittaType || 'clouds',
                toType: nextStage.params.nimittaType || 'clouds',
                factor: blend,
                fromParams: prevStage.params,
                toParams: nextStage.params
            };
            this.renderStage(nextStage, { ...nextStage.params, transition });
            return;
        }

        // For other transitions, use alpha blending
        const fadeOut = 1 - blend;
        const fadeIn = blend;

        if (fadeOut > 0.01) {
            this.ctx.globalAlpha = fadeOut;
            this.renderStage(prevStage, this.getBlendedParams(prevStage, nextStage, 0));
            this.ctx.globalAlpha = 1;
        }

        if (fadeIn > 0.01) {
            this.ctx.globalAlpha = fadeIn;
            this.renderStage(nextStage, params);
            this.ctx.globalAlpha = 1;
        }
    }

    renderStage(stage, params) {
        switch (stage.mode) {
            case 'SAMATHA_BREATH': this.renderBreath(params); break;
            case 'SAMATHA_NIMITTA': this.renderNimitta(params); break;
            case 'JHANA': this.renderJhana(params); break;
            case 'JHANA_FACTORS_HEARTBASE': this.renderJhanaFactorsHeartbase(params); break;
            case 'ARUPA': this.renderArupa(params); break;
            case 'VIPASSANA_RUPA': this.renderKalapas(params); break;
            case 'VIPASSANA_NAMA': this.renderNama(params); break;
            case 'TIME_TUNNEL': this.renderTimeTunnel(params); break;
            case 'NANA_RISEFALL': this.renderRiseFall(params); break;
            case 'NANA_DISSOLUTION': this.renderDissolution(params); break;
            case 'NANA_TERROR': this.renderTerror(params); break;
            case 'NANA_EQUANIMITY': this.renderEquanimity(params); break;
        }
    }

    // --- RENDERER 1: BREATH & VISUAL FIELD NOISE (OPTIMIZED) ---
    renderBreath(p) {
        const noise = p.noise !== undefined ? p.noise : 0.3;
        const greyEmergence = p.greyEmergence !== undefined ? p.greyEmergence : 0;
        const time = this.state.time;
        const breath = Math.sin(this.state.breathPhase);

        // Layer 1: Tile the pre-generated noise texture with movement
        // As greyEmergence increases, the colorful noise becomes more muted/grey
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.globalAlpha = noise * 0.6 * (1 - greyEmergence * 0.5);
        
        const tileSize = 256;
        const offsetX = (time * 20) % tileSize;
        const offsetY = (time * 15) % tileSize;
        
        for (let x = -tileSize - this.cx; x < this.cx + tileSize; x += tileSize) {
            for (let y = -tileSize - this.cy; y < this.cy + tileSize; y += tileSize) {
                this.ctx.drawImage(this.noiseCanvas, x + offsetX, y + offsetY);
            }
        }
        
        // Regenerate noise occasionally for variety
        if (Math.random() < 0.02) {
            this.generateNoiseTextures();
        }
        
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';

        // Layer 2: Smoky colored wisps
        // As greyEmergence increases, colors shift toward grey/smoke
        for (let i = 0; i < this.wisps.length; i++) {
            const wisp = this.wisps[i];
            
            wisp.x += Math.sin(time * wisp.speed + wisp.phase) * 0.002;
            wisp.y += Math.cos(time * wisp.speed * 0.8 + wisp.phase) * 0.002;
            
            if (wisp.x > 1.5) wisp.x = -1.5;
            if (wisp.x < -1.5) wisp.x = 1.5;
            if (wisp.y > 1.5) wisp.y = -1.5;
            if (wisp.y < -1.5) wisp.y = 1.5;
            
            const wx = wisp.x * this.cx;
            const wy = wisp.y * this.cy;
            const wSize = wisp.size * (1 + Math.sin(time * 0.5 + i) * 0.3);
            
            const grad = this.ctx.createRadialGradient(wx, wy, 0, wx, wy, wSize);
            
            // Shift from colored to grey as greyEmergence increases
            const baseHue = 260 + wisp.hue + Math.sin(time * 0.2 + i) * 20;
            const saturation = wisp.saturation * (1 - greyEmergence * 0.8); // Desaturate toward grey
            const light = 25 + Math.sin(time * 0.3 + i * 0.5) * 10 + greyEmergence * 15; // Slightly brighter greys
            
            const alpha = noise * 0.25;
            grad.addColorStop(0, `hsla(${baseHue}, ${saturation}%, ${light + 15}%, ${alpha})`);
            grad.addColorStop(0.5, `hsla(${baseHue + 10}, ${saturation * 0.8}%, ${light}%, ${alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
        }

        // Layer 3: Emerging grey smokiness (precursor to parikamma nimitta)
        // This layer appears and grows as greyEmergence increases
        if (greyEmergence > 0) {
            for (let c = 0; c < 10; c++) {
                const seed = c * 137.5;
                // These move slower and more cohesively than the chaotic wisps
                const driftX = Math.sin(time * 0.03 + seed) * this.cx * 0.5 + 
                              Math.cos(time * 0.02 + seed * 0.7) * this.cx * 0.3;
                const driftY = Math.cos(time * 0.025 + seed * 1.3) * this.cy * 0.4 +
                              Math.sin(time * 0.015 + seed * 0.5) * this.cy * 0.3;
                
                const cloudSize = 100 + Math.sin(time * 0.08 + c) * 50 + (c % 3) * 40;
                const greyBase = 60 + (c % 4) * 12;
                const alpha = greyEmergence * (0.12 + Math.sin(time * 0.15 + c * 0.5) * 0.04);
                
                const grad = this.ctx.createRadialGradient(driftX, driftY, 0, driftX, driftY, cloudSize);
                grad.addColorStop(0, `rgba(${greyBase + 20}, ${greyBase + 15}, ${greyBase + 25}, ${alpha})`);
                grad.addColorStop(0.5, `rgba(${greyBase}, ${greyBase - 5}, ${greyBase + 10}, ${alpha * 0.5})`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                
                this.ctx.fillStyle = grad;
                this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
            }
        }

        // Layer 4: Occasional bright phosphene flashes (decrease as grey emerges)
        const flashChance = noise * 0.1 * (1 - greyEmergence * 0.7);
        if (noise > 0.3 && Math.random() < flashChance) {
            const flashX = (Math.random() - 0.5) * this.width * 0.8;
            const flashY = (Math.random() - 0.5) * this.height * 0.8;
            const flashSize = 20 + Math.random() * 60;
            
            const flashGrad = this.ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, flashSize);
            // As grey emerges, flashes become more grey/white
            const flashHue = greyEmergence > 0.3 ? 0 : (Math.random() < 0.5 ? 280 : (Math.random() < 0.5 ? 200 : 30));
            const flashSat = 60 * (1 - greyEmergence);
            flashGrad.addColorStop(0, `hsla(${flashHue}, ${flashSat}%, 50%, 0.3)`);
            flashGrad.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = flashGrad;
            this.ctx.beginPath();
            this.ctx.arc(flashX, flashY, flashSize, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Layer 5: Subtle breath-synchronized field glow
        const breathAlpha = (breath + 1) * 0.03 * (0.5 + greyEmergence * 0.5);
        const breathGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 200);
        // Glow becomes more grey as grey emerges
        const glowGrey = 100 + greyEmergence * 30;
        breathGrad.addColorStop(0, `rgba(${glowGrey}, ${glowGrey + 5}, ${glowGrey + 10}, ${breathAlpha})`);
        breathGrad.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = breathGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 200, 0, Math.PI * 2);
        this.ctx.fill();

        // Layer 6: Dark patches/voids (become less prominent as grey emerges)
        for (let i = 0; i < 5; i++) {
            const voidX = Math.sin(time * 0.1 + i * 1.5) * this.cx * 0.5;
            const voidY = Math.cos(time * 0.08 + i * 2) * this.cy * 0.5;
            const voidSize = 100 + Math.sin(time * 0.15 + i) * 40;
            
            const voidGrad = this.ctx.createRadialGradient(voidX, voidY, 0, voidX, voidY, voidSize);
            voidGrad.addColorStop(0, `rgba(0, 0, 5, ${noise * 0.3 * (1 - greyEmergence * 0.5)})`);
            voidGrad.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = voidGrad;
            this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
        }
    }

    // --- RENDERER 2: NIMITTA ---
    // Key: The visual field maintains continuity - nimitta forms ON TOP of existing field
    renderNimitta(p) {
        const noise = p.noise !== undefined ? p.noise : 0;
        const greyEmergence = p.greyEmergence !== undefined ? p.greyEmergence : 0.5;
        const nimittaStr = p.nimittaStr !== undefined ? p.nimittaStr : 0;
        const nimittaType = p.nimittaType || 'clouds';
        const time = this.state.time;
        const transition = p.transition || null;

        // LAYER 1: Continue rendering the base visual field (maintains continuity)
        // This is similar to the breath renderer's background
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.globalAlpha = 0.3 * (1 - nimittaStr * 0.3); // Fade slightly as nimitta strengthens
        
        const offsetX = (time * 8) % 256;
        const offsetY = (time * 6) % 256;
        
        for (let x = -256 - this.cx; x < this.cx + 256; x += 256) {
            for (let y = -256 - this.cy; y < this.cy + 256; y += 256) {
                this.ctx.drawImage(this.noiseCanvas, x + offsetX, y + offsetY);
            }
        }
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';

        // LAYER 2: Grey/smoky wisps (continuing from breath stage)
        for (let i = 0; i < 15; i++) {
            const wisp = this.wisps[i];
            const wx = wisp.x * this.cx;
            const wy = wisp.y * this.cy;
            const wSize = wisp.size * 0.8;
            
            const grad = this.ctx.createRadialGradient(wx, wy, 0, wx, wy, wSize);
            // Mostly grey now (high greyEmergence)
            const greyVal = 50 + Math.sin(time * 0.2 + i) * 15;
            const alpha = 0.15 * (1 - nimittaStr * 0.4);
            grad.addColorStop(0, `rgba(${greyVal + 20}, ${greyVal + 15}, ${greyVal + 25}, ${alpha})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
        }

        // CLOUDS - Parikamma: White/grey mist forming across the field
        const buildEntries = () => {
            if (transition && transition.toType && transition.fromType) {
                const entries = [];
                if (transition.fromType) {
                    entries.push({
                        type: transition.fromType,
                        params: transition.fromParams || {},
                        weight: Math.max(0, 1 - transition.factor),
                        phase: 'out',
                        factor: transition.factor,
                        otherType: transition.toType
                    });
                }
                if (transition.toType) {
                    entries.push({
                        type: transition.toType,
                        params: transition.toParams || p,
                        weight: transition.factor,
                        phase: 'in',
                        factor: transition.factor,
                        otherType: transition.fromType
                    });
                }
                return entries;
            }
            return [{
                type: nimittaType,
                params: p,
                weight: 1,
                phase: 'steady',
                factor: 1,
                otherType: null
            }];
        };

        const entries = buildEntries();

        const renderParikammaClouds = (entry) => {
            const intensity = (entry.params.nimittaStr ?? nimittaStr ?? 0.5) * entry.weight;
            if (intensity <= 0.01) return;

            const gatherFactor = (entry.otherType === 'cotton' && entry.phase === 'out') ? entry.factor : 0;
            const rewildFactor = (entry.otherType === 'cotton' && entry.phase === 'in') ? entry.factor : 0;

            // Use 'smoky' texture for Uggaha Nimitta
            const cloudCount = Math.floor(20 + intensity * 10); // More, smaller clouds for smoke
            
            for (let c = 0; c < cloudCount; c++) {
                const seed = c * 137.5;
                // Slow motion vapor movement
                let driftX = Math.sin(time * 0.02 + seed) * this.cx * 0.8 +
                             Math.cos(time * 0.015 + seed * 0.7) * this.cx * 0.4;
                let driftY = Math.cos(time * 0.025 + seed * 1.3) * this.cy * 0.7 +
                             Math.sin(time * 0.01 + seed * 0.5) * this.cy * 0.4;

                driftX *= (1 - gatherFactor * 0.85) + rewildFactor * 0.15;
                driftY *= (1 - gatherFactor * 0.85) + rewildFactor * 0.15;

                const cloudSize = 80 + Math.sin(time * 0.05 + c) * 40 + (c % 3) * 30;
                
                // Smoky Grey Texture
                const greyBase = 100 + (c % 5) * 20; // Grey range
                const alpha = intensity * (0.15 + Math.sin(time * 0.1 + c * 0.5) * 0.05);

                const grad = this.ctx.createRadialGradient(driftX, driftY, 0, driftX, driftY, cloudSize);
                grad.addColorStop(0, `rgba(${greyBase + 20}, ${greyBase + 20}, ${greyBase + 30}, ${alpha})`);
                grad.addColorStop(0.4, `rgba(${greyBase}, ${greyBase}, ${greyBase + 10}, ${alpha * 0.6})`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');

                this.ctx.fillStyle = grad;
                this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
            }
        };

        const renderCottonCore = (entry) => {
            const baseStrength = entry.params.nimittaStr ?? nimittaStr ?? 0.7;
            const intensity = baseStrength * entry.weight;
            if (intensity <= 0.01) return;

            const fromClouds = entry.otherType === 'clouds' && entry.phase === 'in';
            const toClouds = entry.otherType === 'clouds' && entry.phase === 'out';
            const toCrystal = entry.otherType === 'crystal' && entry.phase === 'out';
            const dissolvingFactor = (toClouds || toCrystal) ? entry.factor : 0;

            const gatherFactor = fromClouds ? entry.factor : (entry.phase === 'steady' ? 1 : Math.max(0.2, 1 - dissolvingFactor));

            const wobbleX = Math.sin(time * 0.1) * 4 * (1 - gatherFactor * 0.8);
            const wobbleY = Math.cos(time * 0.08) * 4 * (1 - gatherFactor * 0.8);
            const coreSize = 60 + intensity * 70 * (1 - dissolvingFactor * 0.3);

            // Condensed white light (Cotton)
            // Soft outer glow
            const outerAlpha = intensity * 0.5 * (1 - dissolvingFactor * 0.5);
            const outerGrad = this.ctx.createRadialGradient(wobbleX, wobbleY, 0, wobbleX, wobbleY, coreSize * 2.2);
            outerGrad.addColorStop(0, `rgba(240, 240, 255, ${outerAlpha})`);
            outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = outerGrad;
            this.ctx.beginPath();
            this.ctx.arc(wobbleX, wobbleY, coreSize * 2.2, 0, Math.PI * 2);
            this.ctx.fill();

            // Dense Cotton Center
            const innerAlpha = intensity * (0.9 - dissolvingFactor * 0.4);
            const coreGrad = this.ctx.createRadialGradient(wobbleX, wobbleY, 0, wobbleX, wobbleY, coreSize);
            coreGrad.addColorStop(0, `rgba(255, 255, 255, ${innerAlpha})`);
            coreGrad.addColorStop(0.7, `rgba(230, 230, 240, ${innerAlpha * 0.8})`);
            coreGrad.addColorStop(1, 'rgba(210, 210, 225, 0)');
            this.ctx.fillStyle = coreGrad;
            this.ctx.beginPath();
            this.ctx.arc(wobbleX, wobbleY, coreSize, 0, Math.PI * 2);
            this.ctx.fill();
        };

        const renderCrystal = (entry) => {
            const baseStrength = entry.params.nimittaStr ?? nimittaStr ?? 1;
            const intensity = baseStrength * entry.weight;
            if (intensity <= 0.01) return;

            const fromCotton = entry.otherType === 'cotton' && entry.phase === 'in';
            const transformFactor = fromCotton ? entry.factor : (entry.phase === 'steady' ? 1 : intensity);

            // Residual cotton haze
            if (fromCotton && entry.factor < 1) {
                const cottonResidual = Math.max(0, 1 - entry.factor);
                const cottonGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 110);
                cottonGrad.addColorStop(0, `rgba(240, 240, 245, ${cottonResidual * 0.4})`);
                cottonGrad.addColorStop(1, 'rgba(0,0,0,0)');
                this.ctx.fillStyle = cottonGrad;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 110, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // "Magnetic" pull effect - distorts the background slightly or draws focus
            // We simulate this by having a very subtle large dark halo or vignette that tightens
            if (intensity > 0.5) {
                 const pullGrad = this.ctx.createRadialGradient(0, 0, 100, 0, 0, Math.max(this.width, this.height));
                 pullGrad.addColorStop(0, 'rgba(0,0,0,0)');
                 pullGrad.addColorStop(0.5, `rgba(0,0,0,${0.3 * intensity})`);
                 this.ctx.fillStyle = pullGrad;
                 this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
            }

            this.ctx.globalCompositeOperation = 'screen';

            // Diamond-like Luminosity (Hard, Sharp)
            const glowSize = 100 + (100 * intensity);
            // Sharper gradient for "hard" light
            const glow = this.ctx.createRadialGradient(0, 0, 10, 0, 0, glowSize);
            glow.addColorStop(0, `rgba(255,255,255,${0.95 * intensity})`);
            glow.addColorStop(0.1, `rgba(240,245,255,${0.8 * intensity})`); // Tight bright core
            glow.addColorStop(0.4, `rgba(200,220,255,${0.2 * intensity})`); // Sharp falloff
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = glow;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
            this.ctx.fill();

            // The "Diamond" Core - very hard edges
            const coreSize = 30 + (20 * intensity);
            this.ctx.shadowBlur = 20 * intensity; // Reduced blur for hardness
            this.ctx.shadowColor = '#fff';
            this.ctx.fillStyle = `rgba(255,255,255,${0.9 + transformFactor * 0.1})`;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Radiant Rays (Diamond diffraction)
            if (intensity > 0.4) {
                this.ctx.strokeStyle = `rgba(255,255,255,${0.8 * intensity})`;
                this.ctx.lineWidth = 1.5;
                this.ctx.beginPath();
                const rayCount = 12;
                for (let i = 0; i < rayCount; i++) {
                    const ang = (i * Math.PI * 2 / rayCount) + (time * 0.02); // Slow rotation
                    // Sharp lines
                    this.ctx.moveTo(Math.cos(ang) * coreSize, Math.sin(ang) * coreSize);
                    this.ctx.lineTo(Math.cos(ang) * (coreSize + 180 * intensity), Math.sin(ang) * (coreSize + 180 * intensity));
                }
                this.ctx.stroke();
                
                // Cross glare
                this.ctx.lineWidth = 3;
                this.ctx.strokeStyle = `rgba(255,255,255,${0.5 * intensity})`;
                this.ctx.beginPath();
                const tilt = time * 0.05;
                this.ctx.moveTo(Math.cos(tilt) * coreSize, Math.sin(tilt) * coreSize);
                this.ctx.lineTo(Math.cos(tilt) * (coreSize + 300 * intensity), Math.sin(tilt) * (coreSize + 300 * intensity));
                this.ctx.moveTo(Math.cos(tilt + Math.PI) * coreSize, Math.sin(tilt + Math.PI) * coreSize);
                this.ctx.lineTo(Math.cos(tilt + Math.PI) * (coreSize + 300 * intensity), Math.sin(tilt + Math.PI) * (coreSize + 300 * intensity));
                
                this.ctx.moveTo(Math.cos(tilt + Math.PI/2) * coreSize, Math.sin(tilt + Math.PI/2) * coreSize);
                this.ctx.lineTo(Math.cos(tilt + Math.PI/2) * (coreSize + 300 * intensity), Math.sin(tilt + Math.PI/2) * (coreSize + 300 * intensity));
                this.ctx.moveTo(Math.cos(tilt - Math.PI/2) * coreSize, Math.sin(tilt - Math.PI/2) * coreSize);
                this.ctx.lineTo(Math.cos(tilt - Math.PI/2) * (coreSize + 300 * intensity), Math.sin(tilt - Math.PI/2) * (coreSize + 300 * intensity));
                this.ctx.stroke();
            }

            this.ctx.globalCompositeOperation = 'source-over';
        };

        for (const entry of entries) {
            if (!entry.type) continue;
            if (entry.weight <= 0.01) continue;

            switch (entry.type) {
                case 'clouds':
                    renderParikammaClouds(entry);
                    break;
                case 'cotton':
                    renderCottonCore(entry);
                    break;
                case 'crystal':
                    renderCrystal(entry);
                    break;
                default:
                    break;
            }
        }
    }

    // --- RENDERER 3: JHANA ---
    renderJhana(p) {
        const color = p.color || '#fff';
        const level = p.level || 1;
        // "Singular, perfectly spherical light source in a void"
        // "Solid, like a sphere of white jade or ice"
        // "Absolute vacuum black environment"
        // "Zero motion, zero vibration"

        // Clear background to absolute black (already done in render loop, but ensuring no noise)
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);

        const radius = Math.min(this.width, this.height) * 0.35; // Fixed size, solid sphere

        // Draw the solid sphere
        // Use a radial gradient to simulate the "solid" 3D look (jade/ice)
        // Center highlight slightly offset to give 3D volume
        const grad = this.ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, 0, 0, 0, radius);
        
        // White jade/ice look: very bright center, smooth falloff to edges, but hard edge at radius
        grad.addColorStop(0, '#ffffff'); 
        grad.addColorStop(0.4, '#f0f8ff'); // AliceBlue tint for "ice" feel
        grad.addColorStop(0.85, '#e0e0e0');
        grad.addColorStop(1, '#a0a0a0'); // Darker edge for solidity
        
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // "Hard" stillness - no extra glow or bloom unless it represents the radiance of the mind
        // Adding a very subtle, static outer rim to separating it from the void
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.3;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;

        // If higher jhana, maybe subtle changes in tint or brightness, but keep form rigid
        if (level >= 3) {
             // Whiter, purer for higher jhanas
             this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
             this.ctx.fill();
        }
    }

    // --- RENDERER 3.5: JHANA FACTORS ---
    renderJhanaFactorsHeartbase(p) {
        const time = this.state.time;
        
        const factors = [
            { name: 'Vitakka', color: '#e74c3c', desc: 'Applied Thought', angle: -Math.PI/2 },
            { name: 'Vicāra', color: '#e67e22', desc: 'Sustained Thought', angle: -Math.PI/2 + (Math.PI*2/5) },
            { name: 'Pīti', color: '#f1c40f', desc: 'Rapture', angle: -Math.PI/2 + (Math.PI*4/5) },
            { name: 'Sukha', color: '#2ecc71', desc: 'Happiness', angle: -Math.PI/2 + (Math.PI*6/5) },
            { name: 'Ekaggatā', color: '#9b59b6', desc: 'One-Pointedness', angle: -Math.PI/2 + (Math.PI*8/5) }
        ];
        
        const bgGlow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 400);
        bgGlow.addColorStop(0, 'rgba(192, 57, 43, 0.15)');
        bgGlow.addColorStop(0.5, 'rgba(100, 50, 50, 0.05)');
        bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = bgGlow;
        this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
        
        const heartPulse = 1 + Math.sin(time * 2) * 0.1;
        const heartRadius = 40 * heartPulse;
        
        this.ctx.shadowBlur = 60;
        this.ctx.shadowColor = '#c0392b';
        
        const heartGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, heartRadius * 1.5);
        heartGrad.addColorStop(0, 'rgba(192, 57, 43, 0.9)');
        heartGrad.addColorStop(0.5, 'rgba(192, 57, 43, 0.4)');
        heartGrad.addColorStop(1, 'rgba(192, 57, 43, 0)');
        
        this.ctx.fillStyle = heartGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, heartRadius * 1.5, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, heartRadius * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '11px "Segoe UI", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('HADAYA VATTHU', 0, heartRadius * 2 + 15);
        this.ctx.font = '9px "Segoe UI", sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.fillText('(Heart Base)', 0, heartRadius * 2 + 28);
        
        const orbitRadius = 160;
        const factorRadius = 30;
        
        factors.forEach((factor, i) => {
            const factorPulse = 1 + Math.sin(time * 1.5 + i * 1.2) * 0.15;
            const angle = factor.angle + time * 0.1;
            
            const fx = Math.cos(angle) * orbitRadius;
            const fy = Math.sin(angle) * orbitRadius;
            
            const grad = this.ctx.createLinearGradient(0, 0, fx, fy);
            grad.addColorStop(0, 'rgba(192, 57, 43, 0.6)');
            grad.addColorStop(0.5, factor.color + '80');
            grad.addColorStop(1, factor.color);
            
            this.ctx.strokeStyle = grad;
            this.ctx.lineWidth = 2 + Math.sin(time * 3 + i) * 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(fx, fy);
            this.ctx.stroke();
            
            for (let pt = 0; pt < 3; pt++) {
                const progress = ((time * 0.5 + pt * 0.33 + i * 0.2) % 1);
                const px = fx * progress;
                const py = fy * progress;
                const particleSize = 3 * (1 - Math.abs(progress - 0.5) * 2);
                
                this.ctx.fillStyle = factor.color;
                this.ctx.beginPath();
                this.ctx.arc(px, py, particleSize, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.shadowBlur = 30;
            this.ctx.shadowColor = factor.color;
            
            const factorGrad = this.ctx.createRadialGradient(fx, fy, 0, fx, fy, factorRadius * factorPulse);
            factorGrad.addColorStop(0, factor.color);
            factorGrad.addColorStop(0.6, factor.color + 'aa');
            factorGrad.addColorStop(1, factor.color + '00');
            
            this.ctx.fillStyle = factorGrad;
            this.ctx.beginPath();
            this.ctx.arc(fx, fy, factorRadius * factorPulse, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath();
            this.ctx.arc(fx, fy, factorRadius * 0.4 * factorPulse, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            
            const labelRadius = orbitRadius + factorRadius + 25;
            const lx = Math.cos(angle) * labelRadius;
            const ly = Math.sin(angle) * labelRadius;
            
            this.ctx.fillStyle = factor.color;
            this.ctx.font = 'bold 12px "Segoe UI", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(factor.name, lx, ly);
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.font = '9px "Segoe UI", sans-serif';
            this.ctx.fillText(factor.desc, lx, ly + 14);
        });
        
        this.ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 10]);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, orbitRadius + factorRadius + 60, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.font = 'italic 11px "Segoe UI", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Fifth Mastery (Paccavekkhana Vasī): Reviewing the Jhana Factors', 0, 280);
    }

    // --- RENDERER 4: ARUPA ---
    renderArupa(p) {
        const subType = p.subType || 'space';

        if (subType === 'space') {
            this.ctx.fillStyle = '#fff';
            for (let i = 0; i < 500; i++) {
                const pt = this.particles[i];
                let dx = pt.x - this.cx;
                let dy = pt.y - this.cy;
                let d = Math.sqrt(dx * dx + dy * dy) + 1;
                
                pt.x += (dx / d) * 3;
                pt.y += (dy / d) * 3;

                if (pt.x < 0 || pt.x > this.width || pt.y < 0 || pt.y > this.height) {
                    pt.x = this.cx + (Math.random() - 0.5) * 10;
                    pt.y = this.cy + (Math.random() - 0.5) * 10;
                }
                this.ctx.fillRect(pt.x - this.cx, pt.y - this.cy, 2, 2);
            }
        } else if (subType === 'consciousness') {
            this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.15)';
            this.ctx.lineWidth = 1;
            for (let i = 0; i < 15; i++) {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, (this.state.time * 30 + i * 60) % 800, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
    }

    // --- RENDERER 5: KALAPAS ---
    renderKalapas(p) {
        // "Macro-shot of a void filled with millions of tiny, transparent clusters of energy"
        // "Vibrating clusters that rapidly flash in and out (high-frequency strobing)"
        // "Chaotic and energetic, like boiling water"
        
        this.ctx.globalCompositeOperation = 'lighter';
        
        // Use many particles to simulate "millions"
        // We reuse the existing particle array but render them differently
        const count = Math.min(this.particles.length, 1500); 
        
        // Time-based chaos
        const t = this.state.time;

        for (let i = 0; i < count; i++) {
            // High-frequency strobing: Randomly skip rendering
            if (Math.random() > 0.3) continue;

            const pt = this.particles[i];
            
            // Base position + Vibration (Chaotic movement)
            // Instead of smooth drift, they jitter violently around a point or move erratically
            // We'll use their stored x/y as a base but add heavy jitter
            
            // Move base position slowly to simulate the "boiling" turnover
            pt.x += (Math.random() - 0.5) * 4;
            pt.y += (Math.random() - 0.5) * 4;
            
            // Wrap around
            if (pt.x < 0) pt.x = this.width;
            if (pt.x > this.width) pt.x = 0;
            if (pt.y < 0) pt.y = this.height;
            if (pt.y > this.height) pt.y = 0;

            const screenX = pt.x - this.cx;
            const screenY = pt.y - this.cy;

            // Jitter for vibration
            const jitterAmount = 4;
            const jx = (Math.random() - 0.5) * jitterAmount;
            const jy = (Math.random() - 0.5) * jitterAmount;

            // Render as a "cluster" of energy
            // Draw a few tiny dots around the center
            const clusterSize = 2 + Math.random() * 3;
            const opacity = 0.3 + Math.random() * 0.7;
            
            this.ctx.fillStyle = `rgba(200, 220, 255, ${opacity})`; // Bluish-white energy
            
            // Main dot
            this.ctx.fillRect(screenX + jx, screenY + jy, 1.5, 1.5);
            
            // 1-2 satellite dots to form a cluster
            if (Math.random() < 0.5) {
                 this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
                 this.ctx.fillRect(screenX + jx + (Math.random()-0.5)*3, screenY + jy + (Math.random()-0.5)*3, 1, 1);
            }
            
            // Occasionally a larger "burst"
            if (Math.random() < 0.05) {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
                this.ctx.beginPath();
                this.ctx.arc(screenX + jx, screenY + jy, 4, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        this.ctx.globalCompositeOperation = 'source-over';
    }

    // --- RENDERER 6: NAMA ---
    renderNama(p) {
        this.ctx.fillStyle = 'rgba(192, 57, 43, 0.5)';
        this.ctx.shadowBlur = 30;
        this.ctx.shadowColor = '#c0392b';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 30, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        const streamLen = 17;
        for (let i = 0; i < streamLen; i++) {
            const angle = (i / streamLen) * Math.PI * 2 + (this.state.time * 0.5);
            const r = 100 + Math.sin(this.state.time * 2 + i) * 10;
            
            const mx = Math.cos(angle) * r;
            const my = Math.sin(angle) * r;

            this.ctx.fillStyle = '#3498db';
            this.ctx.beginPath();
            this.ctx.arc(mx, my, 5, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(mx, my);
            this.ctx.stroke();
        }
    }

    // --- RENDERER 7: TIME TUNNEL ---
    renderTimeTunnel(p) {
        const dir = p.dir || -1;
        const speed = p.speed || 2;

        this.ctx.strokeStyle = dir === -1 ? '#d4af37' : '#2980b9';
        this.ctx.lineWidth = 1;

        for (let i = 0; i < 20; i++) {
            let z = (this.state.time * 100 * speed + i * 100) % 2000;
            if (dir === -1) z = 2000 - z;

            const scale = 300 / (z + 10);
            if (scale > 5) continue;

            this.ctx.globalAlpha = Math.min(1, z / 1000);
            
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 100 * scale, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.fillStyle = '#fff';
            for (let k = 0; k < 3; k++) {
                const ang = (k * Math.PI * 2 / 3) + (this.state.time * 0.5 * dir);
                const nx = Math.cos(ang) * 100 * scale;
                const ny = Math.sin(ang) * 100 * scale;
                this.ctx.fillRect(nx - 2, ny - 2, 4 * scale, 4 * scale);
            }
        }
        this.ctx.globalAlpha = 1;
    }

    // --- RENDERER 8: NANAS ---
    renderRiseFall(p) {
        const flicker = p.flicker !== undefined ? p.flicker : 0.9;
        const color = p.color || '#ffd700';

        this.ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 50; i++) {
            if (Math.random() > flicker) {
                const x = (Math.random() - 0.5) * this.width;
                const y = (Math.random() - 0.5) * this.height;
                const sz = Math.random() * 4;
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(x, y, sz, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        this.ctx.globalCompositeOperation = 'source-over';
    }

    renderDissolution(p) {
        this.ctx.fillStyle = '#555';
        for (let i = 0; i < 500; i++) {
            const pt = this.particles[i];
            pt.x += pt.vx * 2;
            pt.y += pt.vy * 2;
            
            pt.size *= 0.98;
            if (pt.size < 0.1) {
                pt.size = Math.random() * 3;
                pt.x = Math.random() * this.width;
                pt.y = Math.random() * this.height;
            }

            this.ctx.fillRect(pt.x - this.cx, pt.y - this.cy, pt.size, pt.size);
        }
    }

    renderTerror(p) {
        this.ctx.strokeStyle = '#c0392b';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 30; i++) {
            this.ctx.beginPath();
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * this.height;
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 100);
            this.ctx.stroke();
        }
    }

    renderEquanimity(p) {
        this.ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
        for (let i = 0; i < 500; i++) {
            const pt = this.particles[i];
            pt.x += 2;
            if (pt.x > this.width) pt.x = 0;
            
            const y = pt.y + Math.sin(pt.x * 0.01 + this.state.time) * 20;
            this.ctx.fillRect(pt.x - this.cx, y - this.cy, 2, 2);
        }
    }
}
