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
            renderParams = { ...currentStage.params };
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
        if (nimittaType === 'clouds') {
            // White misty clouds forming (not replacing the field, adding to it)
            for (let c = 0; c < 12; c++) {
                const seed = c * 137.5;
                const driftX = Math.sin(time * 0.04 + seed) * this.cx * 0.6 + 
                              Math.cos(time * 0.025 + seed * 0.7) * this.cx * 0.35;
                const driftY = Math.cos(time * 0.035 + seed * 1.3) * this.cy * 0.5 +
                              Math.sin(time * 0.018 + seed * 0.5) * this.cy * 0.3;
                
                const cloudSize = 100 + Math.sin(time * 0.08 + c) * 50 + (c % 3) * 40;
                // Whiter clouds (not grey) - like white mist
                const whiteBase = 140 + (c % 4) * 20;
                const alpha = nimittaStr * (0.12 + Math.sin(time * 0.15 + c * 0.5) * 0.04);
                
                const grad = this.ctx.createRadialGradient(driftX, driftY, 0, driftX, driftY, cloudSize);
                grad.addColorStop(0, `rgba(${whiteBase + 30}, ${whiteBase + 25}, ${whiteBase + 35}, ${alpha})`);
                grad.addColorStop(0.4, `rgba(${whiteBase}, ${whiteBase - 5}, ${whiteBase + 10}, ${alpha * 0.6})`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                
                this.ctx.fillStyle = grad;
                this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
            }
            
            // White shiny spots / sparkles within the mist
            for (let s = 0; s < 20; s++) {
                // Spots appear and fade based on time
                const spotPhase = (time * 0.3 + s * 0.5) % 3;
                if (spotPhase > 1) continue; // Only show part of the time
                
                const spotAlpha = Math.sin(spotPhase * Math.PI) * nimittaStr * 0.6;
                if (spotAlpha < 0.05) continue;
                
                const spotX = Math.sin(time * 0.1 + s * 2.3) * this.cx * 0.7 +
                             Math.cos(time * 0.07 + s * 1.7) * this.cx * 0.3;
                const spotY = Math.cos(time * 0.08 + s * 1.9) * this.cy * 0.6 +
                             Math.sin(time * 0.05 + s * 2.1) * this.cy * 0.3;
                const spotSize = 8 + Math.sin(s * 0.7) * 6;
                
                const spotGrad = this.ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotSize);
                spotGrad.addColorStop(0, `rgba(255, 255, 255, ${spotAlpha})`);
                spotGrad.addColorStop(0.5, `rgba(220, 225, 235, ${spotAlpha * 0.5})`);
                spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
                
                this.ctx.fillStyle = spotGrad;
                this.ctx.beginPath();
                this.ctx.arc(spotX, spotY, spotSize, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        // COTTON - Uggaha: Clouds coalescing into a defined white form
        else if (nimittaType === 'cotton') {
            // First, render diffuse clouds (like parikamma but starting to gather)
            // These clouds gradually move toward center as nimittaStr increases
            for (let c = 0; c < 10; c++) {
                const seed = c * 137.5;
                // Clouds drift toward center as strength increases
                const gatherFactor = nimittaStr * 0.6;
                const baseX = Math.sin(time * 0.04 + seed) * this.cx * 0.5;
                const baseY = Math.cos(time * 0.035 + seed * 1.3) * this.cy * 0.4;
                const driftX = baseX * (1 - gatherFactor);
                const driftY = baseY * (1 - gatherFactor);
                
                const cloudSize = 80 + Math.sin(time * 0.08 + c) * 40;
                const whiteBase = 160 + (c % 4) * 15;
                const alpha = 0.15 * (1 - nimittaStr * 0.3);
                
                const grad = this.ctx.createRadialGradient(driftX, driftY, 0, driftX, driftY, cloudSize);
                grad.addColorStop(0, `rgba(${whiteBase}, ${whiteBase - 5}, ${whiteBase + 5}, ${alpha})`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                
                this.ctx.fillStyle = grad;
                this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
            }
            
            // Shiny spots (continuing from parikamma, also gathering)
            for (let s = 0; s < 15; s++) {
                const spotPhase = (time * 0.25 + s * 0.6) % 2.5;
                if (spotPhase > 1) continue;
                
                const spotAlpha = Math.sin(spotPhase * Math.PI) * 0.5;
                if (spotAlpha < 0.05) continue;
                
                // Spots also gather toward center
                const gatherFactor = nimittaStr * 0.7;
                const baseX = Math.sin(time * 0.1 + s * 2.3) * this.cx * 0.5;
                const baseY = Math.cos(time * 0.08 + s * 1.9) * this.cy * 0.4;
                const spotX = baseX * (1 - gatherFactor);
                const spotY = baseY * (1 - gatherFactor);
                const spotSize = 6 + Math.sin(s * 0.7) * 4;
                
                const spotGrad = this.ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotSize);
                spotGrad.addColorStop(0, `rgba(255, 255, 255, ${spotAlpha})`);
                spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
                
                this.ctx.fillStyle = spotGrad;
                this.ctx.beginPath();
                this.ctx.arc(spotX, spotY, spotSize, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // The coalescing white center (cotton-like)
            const wobbleX = Math.sin(time * 0.15) * 8 * (1 - nimittaStr);
            const wobbleY = Math.cos(time * 0.12) * 8 * (1 - nimittaStr);
            const coreSize = 60 + nimittaStr * 60;
            
            // Soft outer glow
            const outerGrad = this.ctx.createRadialGradient(wobbleX, wobbleY, 0, wobbleX, wobbleY, coreSize * 1.8);
            outerGrad.addColorStop(0, `rgba(230, 230, 235, ${nimittaStr * 0.7})`);
            outerGrad.addColorStop(0.5, `rgba(200, 200, 210, ${nimittaStr * 0.4})`);
            outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = outerGrad;
            this.ctx.beginPath();
            this.ctx.arc(wobbleX, wobbleY, coreSize * 1.8, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Dense white center
            const coreGrad = this.ctx.createRadialGradient(wobbleX, wobbleY, 0, wobbleX, wobbleY, coreSize);
            coreGrad.addColorStop(0, `rgba(250, 250, 255, ${nimittaStr * 0.9})`);
            coreGrad.addColorStop(0.6, `rgba(220, 220, 230, ${nimittaStr * 0.6})`);
            coreGrad.addColorStop(1, 'rgba(180, 180, 190, 0)');
            
            this.ctx.fillStyle = coreGrad;
            this.ctx.beginPath();
            this.ctx.arc(wobbleX, wobbleY, coreSize, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Cotton-like fluffy edges
            for (let k = 0; k < 12; k++) {
                const angle = (k / 12) * Math.PI * 2 + time * 0.03;
                const dist = coreSize * (0.7 + Math.sin(time * 0.2 + k) * 0.15);
                const blobX = wobbleX + Math.cos(angle) * dist;
                const blobY = wobbleY + Math.sin(angle) * dist;
                const blobSize = 20 + Math.sin(k * 0.5 + time * 0.1) * 10;
                
                const blobGrad = this.ctx.createRadialGradient(blobX, blobY, 0, blobX, blobY, blobSize);
                blobGrad.addColorStop(0, `rgba(245, 245, 250, ${nimittaStr * 0.5})`);
                blobGrad.addColorStop(1, 'rgba(0,0,0,0)');
                
                this.ctx.fillStyle = blobGrad;
                this.ctx.beginPath();
                this.ctx.arc(blobX, blobY, blobSize, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        // CRYSTAL - Patibhaga: Radiant transparent light
        else if (nimittaType === 'crystal') {
            // Some remaining background wisps (very faint)
            for (let c = 0; c < 5; c++) {
                const driftX = Math.sin(time * 0.03 + c * 2) * this.cx * 0.3;
                const driftY = Math.cos(time * 0.025 + c * 2.5) * this.cy * 0.3;
                
                const grad = this.ctx.createRadialGradient(driftX, driftY, 0, driftX, driftY, 100);
                grad.addColorStop(0, `rgba(180, 180, 190, ${0.08 * (1 - nimittaStr * 0.5)})`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                
                this.ctx.fillStyle = grad;
                this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
            }
            
            this.ctx.globalCompositeOperation = 'screen';
            
            // Brilliant outer glow
            const glowSize = 120 + (130 * nimittaStr);
            const glow = this.ctx.createRadialGradient(0, 0, 20, 0, 0, glowSize);
            glow.addColorStop(0, `rgba(255,255,255,${0.9 * nimittaStr})`);
            glow.addColorStop(0.3, `rgba(230,240,255,${0.5 * nimittaStr})`);
            glow.addColorStop(0.6, `rgba(200,220,255,${0.25 * nimittaStr})`);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = glow;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
            this.ctx.fill();

            // Brilliant core
            const coreSize = 35 + (25 * nimittaStr);
            this.ctx.shadowBlur = 60 * nimittaStr;
            this.ctx.shadowColor = '#fff';
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            
            // Radiating rays
            if (nimittaStr > 0.4) {
                this.ctx.strokeStyle = `rgba(255,255,255,${0.6 * nimittaStr})`;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const ang = (i * Math.PI / 4) + (time * 0.04);
                    this.ctx.moveTo(Math.cos(ang) * coreSize, Math.sin(ang) * coreSize);
                    this.ctx.lineTo(Math.cos(ang) * (coreSize + 120 * nimittaStr), Math.sin(ang) * (coreSize + 120 * nimittaStr));
                }
                this.ctx.stroke();
            }
            
            this.ctx.globalCompositeOperation = 'source-over';
        }
    }

    // --- RENDERER 3: JHANA ---
    renderJhana(p) {
        const color = p.color || '#fff';
        const level = p.level || 1;
        const radius = Math.max(this.width, this.height) * (0.6 + level * 0.1);

        const grad = this.ctx.createRadialGradient(0, 0, 10, 0, 0, radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.2, color);
        grad.addColorStop(1, '#000');

        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
        this.ctx.globalCompositeOperation = 'source-over';
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
        this.ctx.globalCompositeOperation = 'lighter';
        
        const gridSize = 12;
        const colors = ['#d4af37', '#ecf0f1', '#e74c3c', '#95a5a6'];
        const bodyRadius = 250;

        for (let i = 0; i < 800; i++) {
            const x = (Math.random() - 0.5) * bodyRadius * 2;
            const y = (Math.random() - 0.5) * bodyRadius * 2;
            
            if (x * x + y * y > bodyRadius * bodyRadius) continue;

            const vx = (Math.random() - 0.5) * 4;
            const vy = (Math.random() - 0.5) * 4;
            const type = Math.floor(Math.random() * 4);
            
            this.ctx.fillStyle = colors[type];
            this.ctx.fillRect(x + vx, y + vy, 2, 2);
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
