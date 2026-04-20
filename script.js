const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

// COORDINATE MAPPING for GRANULAR DETECTION
const ZONES = {
    INDUSTRIAL: [[41.821, -71.418], [41.815, -71.414], [41.819, -71.403]], // I-95/I-195 Interchanges
    GREEN: [[41.831, -71.409], [41.826, -71.396], [41.784, -71.415]],     // Prospect Terrace, East Side, Roger Williams
    WATER: [[41.824, -71.404], [41.818, -71.401], [41.829, -71.403]]      // River, Canal, ponds
};

let map, marker, chimePoly, bassSynth, masterReverb, masterDelay, masterGain, lowPass;
let isAudioActive = false;
let currentRadius = 500;

function init() {
    const startPos = [41.8245, -71.4128]; // Kennedy Plaza
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function checkProximity(pos, zoneArray, threshold = 600) {
        return zoneArray.some(coord => L.latLng(coord).distanceTo(pos) < threshold);
    }

    function updateAudioParameters() {
        if (!isAudioActive) return;
        const pos = marker.getLatLng();
        const sizeFactor = currentRadius / 2000;

        // GRANULAR SENSING
        const isIndustrial = checkProximity(pos, ZONES.INDUSTRIAL, 700);
        const isGreen = checkProximity(pos, ZONES.GREEN, 800);
        const isWater = checkProximity(pos, ZONES.WATER, 400);

        // 1. RHYTHM & SPEED
        let targetBPM = 60;
        if (isIndustrial) targetBPM = 110;
        if (isWater) targetBPM = 45;
        Tone.Transport.bpm.rampTo(targetBPM, 1);

        // 2. LAYERED EFFECTS
        // Industrial: Brighter, sharper resonance
        lowPass.frequency.rampTo(isIndustrial ? 4000 : 1200, 1);
        lowPass.Q.value = isIndustrial ? 6 : 1;

        // Green: Longer, softer "bloom"
        const attackVal = isGreen ? 0.6 : 0.02;
        chimePoly.set({ envelope: { attack: attackVal, release: 2 + (sizeFactor * 4) } });

        // 3. BASE (SUB-LEVEL)
        // The base is always on, but gets "heavier" in green/water zones
        const baseVol = (isGreen || isWater) ? -15 : -25;
        bassSynth.volume.rampTo(baseVol + (sizeFactor * 10), 1);
        
        masterReverb.wet.rampTo(0.1 + (sizeFactor * 0.5) + (isWater ? 0.3 : 0), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(0.8, 2);

            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.2 }).connect(masterGain);
            masterDelay = new Tone.FeedbackDelay("8n.", 0.35).connect(masterReverb);
            lowPass = new Tone.Filter(1500, "lowpass").connect(masterDelay);

            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 2 }
            }).connect(lowPass);

            // PERMANENT BASE LAYER (Triangle for warmth)
            bassSynth = new Tone.MonoSynth({
                oscillator: { type: "triangle" },
                envelope: { attack: 2, release: 4 }
            }).connect(masterGain);
            bassSynth.triggerAttack("C2");
            bassSynth.volume.value = -25;

            new Tone.Loop(time => {
                let pool = Math.random() > 0.8 ? VARIATION_NOTES : BASE_NOTES;
                let note = pool[Math.floor(Math.random() * pool.length)];
                chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            updateAudioParameters();
            startBtn.innerText = "PROBE ONLINE";
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
        updateAudioParameters();
    };

    slider.oninput = sync;
    marker.on('drag', sync);
    map.on('zoom move', sync);
    
    // Clear initial blur
    setTimeout(sync, 100);
}

window.onload = init;