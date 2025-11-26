/**
 * PA-AUK SAYADAW MEDITATION SIMULATOR
 * Entry Point with Mode Selection
 */

import { PaAukEngine } from './engine/PaAukEngine.js';
import { getTotalMeditationTime } from './config/stages.js';

let app = null;
let selectedSpeed = 120; // Default acceleration

// Initialize start screen
function initStartScreen() {
    // Calculate and display total meditation time
    const totalMinutes = getTotalMeditationTime();
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    document.getElementById('total-time-display').innerText = `~${hours}h ${mins}m`;

    // Mode selection buttons
    document.getElementById('mode-manual').addEventListener('click', () => {
        startSimulation('manual');
    });

    document.getElementById('mode-realtime').addEventListener('click', () => {
        // Show speed selection
        document.getElementById('speed-selection').style.display = 'block';
        
        // Hide mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        });
    });

    // Speed selection buttons
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update selection
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSpeed = parseInt(btn.dataset.speed);
        });
    });

    // Start real-time simulation button
    document.getElementById('btn-start-realtime').addEventListener('click', () => {
        startSimulation('realtime', selectedSpeed);
    });
}

// Start the simulation
function startSimulation(mode, timeAcceleration = 120) {
    // Hide start screen
    document.getElementById('start-screen').style.display = 'none';
    
    // Show viewport
    document.getElementById('viewport').style.display = 'flex';
    
    // Create engine with selected mode
    app = new PaAukEngine(mode, timeAcceleration);
}

// Initialize when DOM is ready
window.onload = () => {
    initStartScreen();
};
