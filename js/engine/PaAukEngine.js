/**
 * PA-AUK SAYADAW MEDITATION SIMULATOR - "THE VISUDDHIMAGGA ENGINE"
 * 
 * Technical Architecture:
 * 1. StageConfig: Defines the 24 stages of the path (Samatha -> Jhana -> Vipassana -> Nibbana).
 * 2. ParticleSystem: A pool of 3000+ reusable particles with multiple render modes.
 * 3. RenderEngine: A state machine that switches between distinct renderers with smooth blending.
 * 4. Real-Time Mode: Automatic progression with smooth visual transitions and meditation timer.
 */

import { STAGES, getTotalMeditationTime } from '../config/stages.js';

export class PaAukEngine {
    constructor(mode = 'manual', timeAcceleration = 120) {
        this.canvas = document.getElementById('simCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        // Create offscreen canvas for blending
        this.offscreenCanvas = document.createElement('canvas');
        this.offCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
        
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.cx = this.width / 2;
        this.cy = this.height / 2;

        // Mode configuration
        this.mode = mode; // 'manual' or 'realtime'
        this.timeAcceleration = timeAcceleration;

        this.state = {
            stageIndex: 0,
            time: 0,
            breathPhase: 0,
            // Real-time mode state
            meditationTime: 0,
            stageTime: 0,
            stageProgress: 0, // 0-1 progress within current stage
            isPaused: false,
            // Smooth transition state
            isTransitioning: false,
            transitionProgress: 0,
            previousStageIndex: 0
        };

        // Transition duration in real seconds (not accelerated)
        this.transitionDuration = 5;

        this.particles = [];
        this.initParticles(3000);

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Bind UI based on mode
        if (this.mode === 'manual') {
            document.getElementById('btn-next').onclick = () => this.changeStage(1);
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

        this.updateUI();
        this.lastFrameTime = performance.now();
        this.loop();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.offscreenCanvas.width = this.width;
        this.offscreenCanvas.height = this.height;
        this.cx = this.width / 2;
        this.cy = this.height / 2;
    }

    initParticles(count) {
        this.particles = [];
        for(let i=0; i<count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                z: Math.random() * 1000,
                vx: (Math.random()-0.5),
                vy: (Math.random()-0.5),
                life: Math.random(),
                size: Math.random() * 2 + 0.5,
                type: Math.floor(Math.random() * 4),
                gridX: 0, gridY: 0
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
        this.state.stageIndex = 0;
        this.state.meditationTime = 0;
        this.state.stageTime = 0;
    }

    changeStage(dir) {
        const next = this.state.stageIndex + dir;
        if(next >= 0 && next < STAGES.length) {
            // Store previous stage for blending
            this.state.previousStageIndex = this.state.stageIndex;
            this.state.stageIndex = next;
            this.state.stageTime = 0;
            this.state.stageProgress = 0;
            
            // Start visual transition
            this.state.isTransitioning = true;
            this.state.transitionProgress = 0;
            
            // Special FX for Nibbana
            if(STAGES[next].mode === 'NIBBANA') {
                const f = document.getElementById('flash-overlay');
                f.style.opacity = 1;
                setTimeout(() => f.style.opacity = 0, 2000);
            }

            this.updateUI();
        }
    }

    // Interpolation helpers
    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    smoothstep(t) {
        return t * t * (3 - 2 * t);
    }

    // Get blended parameters between two stages
    getBlendedParams(prevStage, nextStage, t) {
        const prevParams = prevStage.params;
        const nextParams = nextStage.params;
        const blended = {};

        // List of numeric params to interpolate
        const numericKeys = ['noise', 'focus', 'nimittaStr', 'breathVis', 'level', 'chaos', 'flicker', 'decay', 'speed', 'dir'];
        
        for (const key of numericKeys) {
            const prevVal = prevParams[key] !== undefined ? prevParams[key] : 0;
            const nextVal = nextParams[key] !== undefined ? nextParams[key] : 0;
            blended[key] = this.lerp(prevVal, nextVal, t);
        }

        // Handle color interpolation
        if (prevParams.color || nextParams.color) {
            blended.color = t < 0.5 ? (prevParams.color || '#fff') : (nextParams.color || '#fff');
        }

        // Handle non-numeric params (switch at appropriate time)
        if (prevParams.nimittaType || nextParams.nimittaType) {
            // Gradual nimitta type transition
            if (t < 0.3) {
                blended.nimittaType = prevParams.nimittaType;
            } else if (t > 0.7) {
                blended.nimittaType = nextParams.nimittaType;
            } else {
                // During middle transition, blend by fading
                blended.nimittaType = nextParams.nimittaType;
                blended.nimittaTransition = (t - 0.3) / 0.4; // 0-1 during transition
            }
        }

        if (prevParams.subType || nextParams.subType) {
            blended.subType = t < 0.5 ? prevParams.subType : nextParams.subType;
        }

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
            if(el) el.classList.add('active');
        });

        if (this.mode === 'manual') {
            document.getElementById('btn-prev').disabled = this.state.stageIndex === 0;
            document.getElementById('btn-next').disabled = this.state.stageIndex === STAGES.length - 1;
        }

        const v = document.getElementById('vignette');
        if(s.mode === 'JHANA') v.style.background = 'radial-gradient(circle, transparent 10%, #000 120%)';
        else if (s.mode === 'ARUPA') v.style.background = 'radial-gradient(circle, transparent 0%, #000 100%)';
        else v.style.background = 'radial-gradient(circle, transparent 30%, #000 110%)';
    }

    updateTimer() {
        const totalSeconds = Math.floor(this.state.meditationTime);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        const timeStr = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('timer-value').innerText = timeStr;

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

        this.state.time += 0.01;

        // Real-time mode updates
        if (this.mode === 'realtime' && !this.state.isPaused) {
            const acceleratedDelta = deltaTime * this.timeAcceleration;
            this.state.meditationTime += acceleratedDelta;
            this.state.stageTime += acceleratedDelta;

            // Update stage progress (0-1)
            const currentStage = STAGES[this.state.stageIndex];
            const stageDurationSeconds = (currentStage.durationMinutes || 1) * 60;
            this.state.stageProgress = Math.min(1, this.state.stageTime / stageDurationSeconds);

            // Check if current stage is complete
            if (this.state.stageTime >= stageDurationSeconds && this.state.stageIndex < STAGES.length - 1) {
                this.changeStage(1);
            }

            this.updateTimer();
        }

        // Update visual transition progress (in real time, not accelerated)
        if (this.state.isTransitioning) {
            this.state.transitionProgress += deltaTime;
            if (this.state.transitionProgress >= this.transitionDuration) {
                this.state.isTransitioning = false;
                this.state.transitionProgress = this.transitionDuration;
            }
        }

        // --- RENDER ---
        this.render(deltaTime);
    }

    render(deltaTime) {
        const currentStage = STAGES[this.state.stageIndex];
        const previousStage = STAGES[this.state.previousStageIndex];

        // Calculate transition blend factor (0 = previous, 1 = current)
        let blendFactor = 1;
        if (this.state.isTransitioning) {
            blendFactor = this.smoothstep(this.state.transitionProgress / this.transitionDuration);
        }

        // In real-time mode, also smoothly transition within stages
        // This creates gradual changes even within a single stage
        let intraStageProgress = 0;
        if (this.mode === 'realtime') {
            intraStageProgress = this.state.stageProgress;
        }

        // Get blended parameters
        let renderParams;
        if (this.state.isTransitioning && this.state.previousStageIndex !== this.state.stageIndex) {
            renderParams = this.getBlendedParams(previousStage, currentStage, blendFactor);
        } else {
            renderParams = { ...currentStage.params };
        }

        // Breath physics
        if (renderParams.breathVis && renderParams.breathVis > 0.01) {
            const freq = (renderParams.noise > 0.1) ? 0.05 : 0.02;
            this.state.breathPhase += freq;
            const bVal = (Math.sin(this.state.breathPhase) + 1) / 2;
            document.getElementById('breath-val').style.height = (bVal * 100) + '%';
        } else {
            document.getElementById('breath-val').style.height = '0%';
        }

        // Clear and setup
        this.ctx.globalCompositeOperation = 'source-over';
        
        if (currentStage.mode === 'NIBBANA' && blendFactor > 0.9) {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.width, this.height);
            return;
        }

        // Background
        if (currentStage.mode === 'NANA_TERROR' && blendFactor > 0.5) {
            this.ctx.fillStyle = '#1a0505';
        } else if (currentStage.mode === 'NANA_DISSOLUTION') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
        } else {
            this.ctx.fillStyle = '#020202';
        }
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(this.cx, this.cy);

        if (renderParams.shake && blendFactor > 0.5) {
            const mag = 5 * blendFactor;
            this.ctx.translate((Math.random()-0.5)*mag, (Math.random()-0.5)*mag);
        }

        // During transition, blend between render modes
        if (this.state.isTransitioning && previousStage.mode !== currentStage.mode) {
            // Render both stages and blend
            this.renderBlended(previousStage, currentStage, renderParams, blendFactor);
        } else {
            // Single stage render
            this.renderStage(currentStage, renderParams);
        }

        this.ctx.restore();
    }

    renderBlended(prevStage, nextStage, params, blend) {
        // For smooth transitions between different render modes,
        // we render the previous stage fading out and next stage fading in
        
        const fadeOut = 1 - blend;
        const fadeIn = blend;

        // Render previous stage with fadeout
        if (fadeOut > 0.01) {
            this.ctx.globalAlpha = fadeOut;
            this.renderStage(prevStage, this.getBlendedParams(prevStage, nextStage, 0));
            this.ctx.globalAlpha = 1;
        }

        // Render next stage with fadein
        if (fadeIn > 0.01) {
            this.ctx.globalAlpha = fadeIn;
            this.renderStage(nextStage, params);
            this.ctx.globalAlpha = 1;
        }
    }

    renderStage(stage, params) {
        switch(stage.mode) {
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

    // --- RENDERER 1: BREATH & CHAOS ---
    renderBreath(p) {
        const breath = Math.sin(this.state.breathPhase);
        const noise = p.noise !== undefined ? p.noise : 0.3;
        
        this.ctx.fillStyle = 'rgba(150, 200, 255, 0.4)';

        for(let i=0; i<1000; i++) {
            let pt = this.particles[i];

            // Blend between chaos and flow based on noise level
            const chaosAmount = Math.min(1, noise * 3);
            const flowAmount = 1 - chaosAmount;

            // Chaos movement
            if (chaosAmount > 0) {
                pt.x += (Math.random()-0.5) * 4 * chaosAmount;
                pt.y += (Math.random()-0.5) * 4 * chaosAmount;
            }

            // Flow movement
            if (flowAmount > 0) {
                const dx = pt.x - this.cx;
                const dy = pt.y - this.cy;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if(dist < 300) {
                    const force = (breath > 0 ? 1 : -0.5) * 2 * flowAmount;
                    pt.x -= (dx/dist) * force;
                    pt.y -= (dy/dist) * force;
                }
                pt.x += (Math.random()-0.5) * flowAmount;
                pt.y += (Math.random()-0.5) * flowAmount;
            }

            // Bounds
            if(pt.x < 0) pt.x = this.width;
            if(pt.x > this.width) pt.x = 0;
            if(pt.y < 0) pt.y = this.height;
            if(pt.y > this.height) pt.y = 0;

            this.ctx.fillRect(pt.x - this.cx, pt.y - this.cy, 1.5, 1.5);
        }
    }

    // --- RENDERER 2: NIMITTA (THE SIGN) ---
    renderNimitta(p) {
        const noise = p.noise !== undefined ? p.noise : 0;
        const nimittaStr = p.nimittaStr !== undefined ? p.nimittaStr : 0;
        const nimittaType = p.nimittaType || 'smoke';

        // Background noise particles
        if(noise > 0) {
            this.ctx.fillStyle = `rgba(255,255,255,${noise})`;
            for(let i=0; i<200; i++) {
                const pt = this.particles[i];
                this.ctx.fillRect(pt.x-this.cx, pt.y-this.cy, 1, 1);
            }
        }

        if(nimittaStr <= 0) return;

        const size = 150;

        // Render based on nimitta type with smooth strength
        if (nimittaType === 'smoke') {
            const wobbleX = Math.sin(this.state.time) * 30 * (1 - nimittaStr * 0.5);
            const wobbleY = Math.cos(this.state.time * 0.7) * 30 * (1 - nimittaStr * 0.5);
            
            const grad = this.ctx.createRadialGradient(wobbleX, wobbleY, 0, 0, 0, size);
            grad.addColorStop(0, `rgba(150, 150, 150, ${nimittaStr * 0.6})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(wobbleX, wobbleY, size, 0, Math.PI*2);
            this.ctx.fill();
        } 
        else if (nimittaType === 'cotton') {
            // Blend from smoke appearance to cotton
            const stability = nimittaStr;
            const wobbleX = Math.sin(this.state.time) * 10 * (1 - stability);
            const wobbleY = Math.cos(this.state.time * 0.7) * 10 * (1 - stability);

            const brightness = 200 + (40 * stability);
            const grad = this.ctx.createRadialGradient(wobbleX, wobbleY, 0, wobbleX, wobbleY, size*0.8);
            grad.addColorStop(0, `rgba(${brightness}, ${brightness}, ${brightness}, ${nimittaStr})`);
            grad.addColorStop(0.8, `rgba(${brightness-40}, ${brightness-40}, ${brightness-40}, ${nimittaStr * 0.8})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(wobbleX, wobbleY, size*0.8, 0, Math.PI*2);
            this.ctx.fill();

            // Texture (grain)
            if (stability > 0.5) {
                this.ctx.fillStyle = `rgba(0,0,0,${0.05 * stability})`;
                for(let k=0; k<50; k++) {
                    const r = Math.random() * size * 0.6;
                    const a = Math.random() * Math.PI * 2;
                    this.ctx.beginPath();
                    this.ctx.arc(wobbleX + Math.cos(a)*r, wobbleY + Math.sin(a)*r, Math.random()*10, 0, Math.PI*2);
                    this.ctx.fill();
                }
            }
        } 
        else if (nimittaType === 'crystal') {
            this.ctx.globalCompositeOperation = 'screen';
            
            // Outer glow (grows with strength)
            const glowSize = 150 + (100 * nimittaStr);
            const glow = this.ctx.createRadialGradient(0, 0, 30, 0, 0, glowSize);
            glow.addColorStop(0, `rgba(255,255,255,${0.8 * nimittaStr})`);
            glow.addColorStop(0.4, `rgba(200,230,255,${0.3 * nimittaStr})`);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = glow;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, glowSize, 0, Math.PI*2);
            this.ctx.fill();

            // Core
            const coreSize = 40 + (20 * nimittaStr);
            this.ctx.shadowBlur = 40 * nimittaStr;
            this.ctx.shadowColor = '#fff';
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, coreSize, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            
            // Rays
            if (nimittaStr > 0.5) {
                this.ctx.strokeStyle = `rgba(255,255,255,${0.5 * nimittaStr})`;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                for(let i=0; i<6; i++) {
                    const ang = (i * Math.PI/3) + (this.state.time * 0.05);
                    this.ctx.moveTo(Math.cos(ang)*coreSize, Math.sin(ang)*coreSize);
                    this.ctx.lineTo(Math.cos(ang)*(coreSize + 140 * nimittaStr), Math.sin(ang)*(coreSize + 140 * nimittaStr));
                }
                this.ctx.stroke();
            }
            
            this.ctx.globalCompositeOperation = 'source-over';
        }
    }

    // --- RENDERER 3: JHANA (ABSORPTION) ---
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

    // --- RENDERER 3.5: JHANA FACTORS AT HEART BASE ---
    renderJhanaFactorsHeartbase(p) {
        const time = this.state.time;
        
        const factors = [
            { name: 'Vitakka', color: '#e74c3c', desc: 'Applied Thought', angle: -Math.PI/2 },
            { name: 'Vicāra', color: '#e67e22', desc: 'Sustained Thought', angle: -Math.PI/2 + (Math.PI*2/5) },
            { name: 'Pīti', color: '#f1c40f', desc: 'Rapture', angle: -Math.PI/2 + (Math.PI*4/5) },
            { name: 'Sukha', color: '#2ecc71', desc: 'Happiness', angle: -Math.PI/2 + (Math.PI*6/5) },
            { name: 'Ekaggatā', color: '#9b59b6', desc: 'One-Pointedness', angle: -Math.PI/2 + (Math.PI*8/5) }
        ];
        
        // Background
        const bgGlow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 400);
        bgGlow.addColorStop(0, 'rgba(192, 57, 43, 0.15)');
        bgGlow.addColorStop(0.5, 'rgba(100, 50, 50, 0.05)');
        bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = bgGlow;
        this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
        
        // Heart Base
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
        
        // Labels
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '11px "Segoe UI", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('HADAYA VATTHU', 0, heartRadius * 2 + 15);
        this.ctx.font = '9px "Segoe UI", sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.fillText('(Heart Base)', 0, heartRadius * 2 + 28);
        
        // Factors
        const orbitRadius = 160;
        const factorRadius = 30;
        
        factors.forEach((factor, i) => {
            const factorPulse = 1 + Math.sin(time * 1.5 + i * 1.2) * 0.15;
            const angle = factor.angle + time * 0.1;
            
            const fx = Math.cos(angle) * orbitRadius;
            const fy = Math.sin(angle) * orbitRadius;
            
            // Connection line
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
            
            // Energy particles
            for(let pt = 0; pt < 3; pt++) {
                const progress = ((time * 0.5 + pt * 0.33 + i * 0.2) % 1);
                const px = fx * progress;
                const py = fy * progress;
                const particleSize = 3 * (1 - Math.abs(progress - 0.5) * 2);
                
                this.ctx.fillStyle = factor.color;
                this.ctx.beginPath();
                this.ctx.arc(px, py, particleSize, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // Factor orb
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
            
            // Labels
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
        
        // Outer ring
        this.ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 10]);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, orbitRadius + factorRadius + 60, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Instruction
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.font = 'italic 11px "Segoe UI", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Fifth Mastery (Paccavekkhana Vasī): Reviewing the Jhana Factors', 0, 280);
    }

    // --- RENDERER 4: ARUPA (SPACE/VOID) ---
    renderArupa(p) {
        const subType = p.subType || 'space';

        if(subType === 'space') {
            this.ctx.fillStyle = '#fff';
            this.particles.forEach(pt => {
                let dx = pt.x - this.cx;
                let dy = pt.y - this.cy;
                let d = Math.sqrt(dx*dx + dy*dy) + 1;
                
                pt.x += (dx/d) * 3;
                pt.y += (dy/d) * 3;

                if(pt.x < 0 || pt.x > this.width || pt.y < 0 || pt.y > this.height) {
                    pt.x = this.cx + (Math.random()-0.5)*10;
                    pt.y = this.cy + (Math.random()-0.5)*10;
                }
                this.ctx.fillRect(pt.x-this.cx, pt.y-this.cy, 2, 2);
            });
        } 
        else if (subType === 'consciousness') {
            this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.15)';
            this.ctx.lineWidth = 1;
            for(let i=0; i<15; i++) {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, (this.state.time*30 + i*60) % 800, 0, Math.PI*2);
                this.ctx.stroke();
            }
        }
        // 'nothing' and 'neither' show mostly black
    }

    // --- RENDERER 5: VIPASSANA RUPA (KALAPAS) ---
    renderKalapas(p) {
        this.ctx.globalCompositeOperation = 'lighter';
        
        const gridSize = 12;
        const cols = Math.ceil(this.width / gridSize);
        const rows = Math.ceil(this.height / gridSize);
        const colors = ['#d4af37', '#ecf0f1', '#e74c3c', '#95a5a6'];
        const bodyRadius = 250;

        for(let r=0; r<rows; r++) {
            for(let c=0; c<cols; c++) {
                const x = (c * gridSize) - this.cx;
                const y = (r * gridSize) - this.cy;
                
                if (x*x + y*y > bodyRadius*bodyRadius) continue;
                if (Math.random() > 0.4) continue;

                const vx = (Math.random()-0.5) * 4;
                const vy = (Math.random()-0.5) * 4;
                const type = (c + r) % 4;
                
                this.ctx.fillStyle = colors[type];
                this.ctx.fillRect(x+vx, y+vy, 2, 2);
            }
        }
        this.ctx.globalCompositeOperation = 'source-over';
    }

    // --- RENDERER 6: VIPASSANA NAMA (MENTALITY) ---
    renderNama(p) {
        this.ctx.fillStyle = 'rgba(192, 57, 43, 0.5)';
        this.ctx.shadowBlur = 30;
        this.ctx.shadowColor = '#c0392b';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 30, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        const streamLen = 17;

        for(let i=0; i<streamLen; i++) {
            const angle = (i / streamLen) * Math.PI * 2 + (this.state.time * 0.5);
            const r = 100 + Math.sin(this.state.time * 2 + i)*10;
            
            const mx = Math.cos(angle) * r;
            const my = Math.sin(angle) * r;

            this.ctx.fillStyle = '#3498db';
            this.ctx.beginPath();
            this.ctx.arc(mx, my, 5, 0, Math.PI*2);
            this.ctx.fill();

            this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            this.ctx.beginPath();
            this.ctx.moveTo(0,0);
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

        const rings = 20;

        for(let i=0; i<rings; i++) {
            let z = (this.state.time * 100 * speed + i * 100) % 2000;
            if (dir === -1) z = 2000 - z;

            const fl = 300;
            const scale = fl / (z + 10);

            if(scale > 5) continue;

            this.ctx.globalAlpha = Math.min(1, z/1000);
            
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 100 * scale, 0, Math.PI*2);
            this.ctx.stroke();

            this.ctx.fillStyle = '#fff';
            for(let k=0; k<3; k++) {
                const ang = (k * Math.PI * 2 / 3) + (this.state.time * 0.5 * dir);
                const nx = Math.cos(ang) * 100 * scale;
                const ny = Math.sin(ang) * 100 * scale;
                this.ctx.fillRect(nx-2, ny-2, 4*scale, 4*scale);
            }
        }
        this.ctx.globalAlpha = 1;
    }

    // --- RENDERER 8: NANAS (INSIGHT) ---
    renderRiseFall(p) {
        const flicker = p.flicker !== undefined ? p.flicker : 0.9;
        const color = p.color || '#ffd700';

        this.ctx.globalCompositeOperation = 'lighter';
        for(let i=0; i<50; i++) {
            if(Math.random() > flicker) {
                const x = (Math.random()-0.5) * this.width;
                const y = (Math.random()-0.5) * this.height;
                const sz = Math.random() * 4;
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(x, y, sz, 0, Math.PI*2);
                this.ctx.fill();
            }
        }
        this.ctx.globalCompositeOperation = 'source-over';
    }

    renderDissolution(p) {
        this.ctx.fillStyle = '#555';
        this.particles.forEach(pt => {
            pt.x += pt.vx * 2;
            pt.y += pt.vy * 2;
            
            pt.size *= 0.96;
            if(pt.size < 0.1) {
                pt.size = Math.random()*3;
                pt.x = Math.random()*this.width;
                pt.y = Math.random()*this.height;
            }

            this.ctx.fillRect(pt.x-this.cx, pt.y-this.cy, pt.size, pt.size);
        });
    }

    renderTerror(p) {
        this.ctx.strokeStyle = '#c0392b';
        this.ctx.lineWidth = 1;
        for(let i=0; i<30; i++) {
            this.ctx.beginPath();
            const x = (Math.random()-0.5) * this.width;
            const y = (Math.random()-0.5) * this.height;
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x + (Math.random()-0.5)*100, y + (Math.random()-0.5)*100);
            this.ctx.stroke();
        }
    }

    renderEquanimity(p) {
        this.ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
        this.particles.forEach((pt, i) => {
            pt.x += 2;
            if(pt.x > this.width) pt.x = 0;
            
            const y = pt.y + Math.sin(pt.x * 0.01 + this.state.time) * 20;
            this.ctx.fillRect(pt.x - this.cx, y - this.cy, 2, 2);
        });
    }
}
