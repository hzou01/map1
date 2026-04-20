// MELODIC PALETTES
const BASE_NOTES = ["C5", "G4", "E5", "B4"];       // The main recurring arpeggio
const VARIATION_NOTES = ["D5", "A4"];                // The higher 'chimney' accents

// YOUR MANUAL COLOR DEFINITION LOOKUP TABLE
// Sampling the Providence map colors directly from image_0.png
const PALETTE = {
    HIGHWAY: [252, 234, 173],     // Bright Red (#ff5d5d) - I-95 / Connection Roads
    ROAD: [255, 255, 255],       // Orange (#ff9e5d) - Streets (Providence Place)
    WATER: [217, 231, 234],     // Light Blue (#a1e3ff) - Rivers / Ponds
    GREEN: [225, 235, 213],     // Soft Grey-Green (#b5d0d0) - Parks (Burnside Park)
    HOUSE: [245, 238, 228]      // Soft Grey (#e0e0e0) - Urban Built Environment
};

let map, marker, chimePoly, variationPoly, humLayer, masterGain, lowPass, sensorCanvas, sensorCtx;
let isAudioActive = false;

function init() {
    const startPos = [41.8245, -71.4128]; // Kennedy Plaza Center
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 16);
    
    // Using a simple tile provider to ensure clean color sampling
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        crossOrigin: true // Critical for pixel-reading permissions
    }).addTo(map);
    
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    // Setup the invisible "Visual Eye" Sensor
    sensorCanvas = document.createElement('canvas');
    sensorCanvas.width = 1;
    sensorCanvas.height = 1;
    sensorCtx = sensorCanvas.getContext('2d', { willReadFrequently: true });

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    // COLOR DETECTION LOGIC
    async function sampleEnvironment() {
        if (!isAudioActive) return;
        const pos = marker.getLatLng();

        // 1. Capture the visual state of the map around the pin
        // This is necessary because Leaflet tiles change position.
        const canvas = await html2canvas(document.getElementById('map'), {
            x: window.innerWidth / 2 - 0.5, // Center the sample on the pin point
            y: window.innerHeight / 2 - 0.5,
            width: 1,
            height: 1,
            useCORS: true
        });

        const pixel = canvas.getContext('2d').getImageData(0, 0, 1, 1).data;
        const [r, g, b] = pixel;

        // HELPER: Calculate color similarity using simple Euclidean distance
        const match = (pCol) => Math.sqrt((r-pCol[0])**2 + (g-pCol[1])**2 + (b-pCol[2])**2);
        const threshold = 15; // Strict match for map colors

        // SENSOR READS:
        const isHighway = match(PALETTE.HIGHWAY) < threshold;
        const isRoad = match(PALETTE.ROAD) < threshold;
        const isWater = match(PALETTE.WATER) < threshold;
        const isGreen = match(PALETTE.GREEN) < threshold;
        const isUrban = (isHighway || isRoad || match(PALETTE.HOUSE) < threshold); // Roads and buildings

        updateAudioFromVisuals(isHighway, isRoad, isWater, isGreen, isUrban);
    }

    function updateAudioFromVisuals(hwy, rod, wat, grn, urb) {
        const sizeFactor = Math.min(parseInt(slider.value) / 2000, 1.0);

        // 1. RHYTHM: Road Red/Orange drives tempo; Water Blue slows it
        let targetBPM = 65;
        if (hwy) targetBPM = 125; 
        if (rod) targetBPM = 110; 
        if (wat) targetBPM = 45;
        Tone.Transport.bpm.rampTo(targetBPM, 1.5);

        // 2. TEXTURE: Roads open the low-pass filter; Water closes it
        lowPass.frequency.rampTo(urb ? 4200 : 1300, 1);
        lowPass.Q.value = urb ? 5 : 1; // Roads add 'Strong Resonance' (Q)

        // Green/Water create softer, 'cloudy' tones with slow bloom (Attack)
        const attackVal = (grn || wat) ? 0.3 : 0.05;
        chimePoly.set({ envelope: { attack: attackVal, release: 2 + (sizeFactor * 4) } });
        
        // Variation Poly is always short/crystalline for accent
        variationPoly.set({ envelope: { attack: 0.02, release: 1 + (grn ? 2 : 0) } });

        // 3. BASE (SUB-LEVEL): Permanently on, but swells with nature/size
        const baseVol = (grn || wat) ? -18 : -28;
        humLayer.volume.rampTo(baseVol + (sizeFactor * 8), 1);
        
        masterGain.gain.rampTo(0.7 + (urb ? 0.1 : 0), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            // A final limiter to prevent distortion (mic breaking)
            const limiter = new Tone.Limiter(-2).toDestination();
            masterGain = new Tone.Gain(0.7).connect(limiter);

            // RHYTHMIC BOUNCE (Dotted 8th delay for clarity)
            const reverb = new Tone.Reverb(10).connect(masterGain);
            const delay = new Tone.FeedbackDelay("8n.", 0.35).connect(reverb);
            lowPass = new Tone.Filter(1500, "lowpass").connect(delay);

            // Layer 1: The Main Chime (Sine / C5-G4-E5-B4)
            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 2 }
            }).connect(lowPass);

            // Layer 2: The Variation Accents (D5-A4)
            // Same synth, different sequence for layering
            variationPoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, decay: 0.1, sustain: 0.4, release: 1 }
            }).connect(lowPass);

            // Layer 3: The Deep Base (Soft Triangle, Static C2 Hum)
            humLayer = new Tone.Oscillator(65.41, "triangle").connect(masterGain); // Low C2
            humLayer.start();
            humLayer.volume.value = -35;

            // Arpeggiator: Loops both melodic palettes separately but together
            new Tone.Loop(time => {
                // The Main Melody (80% prob.)
                if (Math.random() < 0.8) {
                    let note = BASE_NOTES[Math.floor(Math.random() * BASE_NOTES.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
                }
                // The Higher Accents (25% prob.)
                if (Math.random() < 0.25) {
                    let accent = VARIATION_NOTES[Math.floor(Math.random() * VARIATION_NOTES.length)];
                    variationPoly.triggerAttackRelease(accent, "16n", time + Tone.Time("16n"), 0.35); // Slight delay for bounce
                }
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            sampleEnvironment();
            startBtn.innerText = "PROBE ACTIVE";
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
        sampleEnvironment(); // Read the color now
    };

    slider.oninput = sync;
    marker.on('dragend', sync);
    map.on('zoommove', sync);
    setTimeout(sync, 150);
}

window.onload = init;