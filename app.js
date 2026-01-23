class SonicGuardian {
    constructor() {
        this.audioCtx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.mode = 'dog'; // dog, sweep, manual
        this.sweepInterval = null;

        // Settings
        this.frequencies = {
            dog: 16500, // Borderline audible - annoying
            sweepMin: 18000,
            sweepMax: 23000,
        };

        // UI Elements
        this.btnToggle = document.getElementById('toggle-btn');
        this.hzDisplay = document.getElementById('hz-display');
        this.emitter = document.querySelector('.emitter-display');
        this.statusText = document.getElementById('status-text');
        this.globe = document.querySelector('.globe-1');

        // Bindings
        this.initListeners();
        this.checkLicense();
    }

    checkLicense() {
        const urlParams = new URLSearchParams(window.location.search);
        const clientName = urlParams.get('cliente');

        if (clientName) {
            // Clean simple XSS protection and get name
            const cleanName = clientName.replace(/[<>]/g, '');

            // 1. Show License Message
            const container = document.getElementById('license-container');
            const nameSpan = document.getElementById('license-name');
            nameSpan.innerText = cleanName;
            container.style.display = 'block';

            // 2. Personalize App Title (Browser Tab)
            document.title = `Guardian Sónico - ${cleanName}`;
        }
    }

    initListeners() {
        this.btnToggle.addEventListener('click', () => this.toggleEmission());

        const slider = document.getElementById('freq-slider');
        slider.addEventListener('input', (e) => {
            if (this.mode === 'manual') {
                const val = e.target.value;
                document.getElementById('freq-value').innerText = val;
                if (this.isPlaying) this.setFrequency(val);
            }
        });
    }

    async initAudio() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }
    }

    startOscillator() {
        this.oscillator = this.audioCtx.createOscillator();
        this.gainNode = this.audioCtx.createGain();

        this.oscillator.type = 'sine'; // Sine is purest, less audible artifacts
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);

        // Start Sound
        this.oscillator.start();

        // Ramp up volume to avoid "pop"
        this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(1, this.audioCtx.currentTime + 0.1);

        this.applyModeSettings();
    }

    stopOscillator() {
        if (this.oscillator) {
            // Ramp down volume
            this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.1);

            setTimeout(() => {
                this.oscillator.stop();
                this.oscillator.disconnect();
                this.oscillator = null;
            }, 150);
        }
        this.stopSweep();
    }

    applyModeSettings() {
        if (!this.oscillator) return;

        // Cancel any ongoing automation
        this.stopSweep();
        this.oscillator.frequency.cancelScheduledValues(this.audioCtx.currentTime);

        if (this.mode === 'dog') {
            this.setFrequency(this.frequencies.dog);
            this.statusText.innerText = "Emisión Constante: Anti-Canino";
        } else if (this.mode === 'sweep') {
            this.startSweep();
            this.statusText.innerText = "Modo Barrido: 18kHz - 23kHz";
        } else {
            const manualFreq = document.getElementById('freq-slider').value;
            this.setFrequency(manualFreq);
            this.statusText.innerText = "Frecuencia Manual";
        }
    }

    setFrequency(val) {
        if (this.oscillator) {
            this.oscillator.frequency.setValueAtTime(val, this.audioCtx.currentTime);
        }
        this.updateDisplay(val);
    }

    updateDisplay(val) {
        this.hzDisplay.innerText = Math.round(val) + " Hz";
    }

    startSweep() {
        if (!this.oscillator) return;

        const cycleDuration = 0.5; // seconds for one up-down cycle
        const now = this.audioCtx.currentTime;

        // Initial set
        this.oscillator.frequency.setValueAtTime(this.frequencies.sweepMin, now);

        // Loop for the sweep using AudioParam automation
        // We schedule ahead a bit. 
        // Since we can't easily loop automation without recreating nodes or using a custom interval,
        // we will use a setInterval to schedule regular ramps.

        const scheduleRamp = () => {
            const t = this.audioCtx.currentTime;
            // Ramp Up
            this.oscillator.frequency.linearRampToValueAtTime(this.frequencies.sweepMax, t + cycleDuration / 2);
            // Ramp Down
            this.oscillator.frequency.linearRampToValueAtTime(this.frequencies.sweepMin, t + cycleDuration);

            this.updateDisplay("BARRIDO");
        };

        scheduleRamp(); // First run
        this.sweepInterval = setInterval(scheduleRamp, cycleDuration * 1000);
    }

    stopSweep() {
        if (this.sweepInterval) {
            clearInterval(this.sweepInterval);
            this.sweepInterval = null;
        }
    }

    async toggleEmission() {
        if (!this.isPlaying) {
            await this.initAudio();
            this.startOscillator();
            this.isPlaying = true;
            this.updateUIState(true);
        } else {
            this.stopOscillator();
            this.isPlaying = false;
            this.updateUIState(false);
        }
    }

    updateUIState(active) {
        if (active) {
            this.btnToggle.innerText = "DETENER";
            this.btnToggle.classList.add('btn-active');
            this.emitter.classList.add('emitting');
        } else {
            this.btnToggle.innerText = "ACTIVAR EMISIÓN";
            this.btnToggle.classList.remove('btn-active');
            this.emitter.classList.remove('emitting');
            this.hzDisplay.innerText = "OFF";
            this.statusText.innerText = "Sistema en espera";
        }
    }

    setMode(newMode) {
        this.mode = newMode;

        // Update styling variables
        const root = document.documentElement;
        let color = '#00d2ff'; // dog
        if (newMode === 'sweep') color = '#ff4d4d'; // Red-ish for aggressive sweep
        if (newMode === 'manual') color = '#ffd700';

        root.style.setProperty('--accent-active', color);

        // Refresh audio if playing
        if (this.isPlaying) {
            this.applyModeSettings();
        }
    }
}

// Global Handling
const app = new SonicGuardian();

function selectMode(modeName) {
    // UI Update
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${modeName}"]`).classList.add('active');

    // Manual Slider Visibility
    const sliderContainer = document.getElementById('manual-controls');
    sliderContainer.style.display = (modeName === 'manual') ? 'flex' : 'none';

    app.setMode(modeName);
}
