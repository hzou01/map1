// High-end, Major-key palette that allows for infinite "freedom" in combinations
const SCALES = {
    BASE: ["C4", "E4", "G4", "B4"], // The "Designer" Chord
    URBAN: ["D5", "A5"],            // High tension / Road resonance
    NATURE: ["F4", "A4"]            // Soft extensions
};

let map, marker, chimePoly, bassSynth, noiseResonator, masterReverb, masterDelay, masterGain;
let isAudioActive = false;
let currentRadius = 500;

function init() {
    const PVD_CENTER = [41.8245, -71.4128];
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(PVD_CENTER, 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(PVD_CENTER, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function updateSensors() {
        const pos = marker.getLatLng();
        const distToCenter = pos.distanceTo(PVD_CENTER);
        
        // 1. INTENSITY CALCULATIONS
        const urbanIntensity = Math.max(0, 1 - (distToCenter / 2500));
        const isNearWater = (pos.lng > -71.402 && pos.lat < 41.815);
        const oceanIntensity = isNearWater ? 0.9 : 0.0;
        const natureIntensity = Math.max(0.2, 1 - urbanIntensity - oceanIntensity);
        const sizeFactor = currentRadius / 2000;

        if (!isAudioActive) return;

        // 2. SPEED: Roads = Fast, Ocean = Slow
        const targetBPM = 55 + (urbanIntensity * 55) - (oceanIntensity * 20);
        Tone.Transport.bpm.rampTo(Math.max(45, targetBPM), 0.5);

        // 3. EFFECT RACK:
        // Urban: High-pass noise + "Strong Resonance"
        noiseResonator.volume.rampTo(-50 + (urbanIntensity * 15), 0.5);
        
        // Nature: "Softer Tones" / High Reverb Shimmer
        masterReverb.wet.rampTo(0.1 + (natureIntensity * 0.4) + (sizeFactor * 0.3), 1);
        
        // Ocean: Low-Pass "Murky" Filter
        const cutoff = 4000 - (oceanIntensity * 3200);
        chimePoly.set({ filter: { frequency: cutoff } });

        // 4. SIZE DYNAMICS: Probe scale increases grounding bass
        bassSynth.volume.rampTo(-30 + (sizeFactor * 15), 0.5);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(0.9, 2);

            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.2 }).connect(masterGain);
            masterDelay = new Tone.FeedbackDelay("8n.", 0.35).connect(masterReverb);

            // MAIN INSTRUMENT
            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 3 }
            }).connect(masterDelay);

            // THE BASS: Pure Grounding Sine
            bassSynth = new Tone.MonoSynth({
                oscillator: { type: "sine" },
                envelope: { attack: 1, release: 4 }
            }).connect(masterGain);
            bassSynth.triggerAttack("C2");

            // INDUSTRIAL RESONANCE: High-frequency road hum
            const roadFilter = new Tone.Filter(2500, "highpass").connect(masterGain);
            noiseResonator = new Tone.Noise("white").connect(roadFilter);
            noiseResonator.start();

            // THE LOOP: Generative combination of nodes
            new Tone.Loop(time => {
                // Base structure (Always plays)
                const baseNote = SCALES.BASE[Math.floor(Math.random() * SCALES.BASE.length)];
                chimePoly.triggerAttackRelease(baseNote, "8n", time, 0.4);

                // Add freedom for combinations based on location
                if (Math.random() < 0.6) {
                    let extraNote;
                    if (Math.random() < 0.5) {
                        // Blend in Urban/High-Road tones
                        extraNote = SCALES.URBAN[Math.floor(Math.random() * SCALES.URBAN.length)];
                    } else {
                        // Blend in Soft-Nature tones
                        extraNote = SCALES.NATURE[Math.floor(Math.random() * SCALES.NATURE.length)];
                    }
                    chimePoly.triggerAttackRelease(extraNote, "4n", time + 0.1, 0.2);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            updateSensors();
        } catch (e) { console.error(e); }
    };

    const sync = () => {
        currentRadius = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = currentRadius + "m";
        const centerPoint = map.latLngToContainerPoint(marker.getLatLng());
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = currentRadius / metersPerPixel;

        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        updateSensors();
    };

    slider.oninput = sync;
    marker.on('drag', sync);
    map.on('zoom move', sync);
}

window.onload = init;