let map, marker, chimePoly, natureBase, waterPad, masterReverb, noiseSynth, waterFlow;
let isAudioActive = false;
let currentRatios = { red: 0, grey: 0, yellow: 0, blue: 0.5 };
let geoTimer; // For debouncing the API

function init() {
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false,
        fadeAnimation: false 
    }).setView([41.8245, -71.4128], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');
    
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        const centerLatLng = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(centerLatLng);

        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const fullPath = `M 0 0 H ${w} V ${h} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;

        frost.style.clipPath = `path('${fullPath}')`;

        // --- DEBOUNCED SENSING ---
        // We wait 200ms after you stop moving to "ping" the server
        clearTimeout(geoTimer);
        geoTimer = setTimeout(() => {
            detectFeatures(centerLatLng);
        }, 200);
    }

    // NEW REVERSE GEOCODER LOGIC
    async function detectFeatures(latlng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // CHECK YOUR CONSOLE (Cmd+Option+J on Mac)
        console.log("OSM Sensed:", data.class, data.type); 

        const category = data.class;
        // If it's a 'place', 'boundary', or 'man_made', treat it as Urban too
        if (["highway", "building", "railway", "place", "man_made"].includes(category)) {
            currentRatios.red = 0.8; currentRatios.grey = 0.9; currentRatios.blue = 0.1;
        } else {
            currentRatios.red = 0.1; currentRatios.grey = 0.1; currentRatios.blue = 0.9;
        }
    } catch (e) {
        // If API fails, default to a 'Working' middle-ground so nodes stay on
        currentRatios.red = 0.5; currentRatios.grey = 0.5; currentRatios.blue = 0.5;
    }
    updateAudioEngine();
}

    // --- 1. REVISED AUDIO ENGINE (QUITE NOISE, LOUD NODES) ---
function updateAudioEngine() {
    if (!isAudioActive) return;

    // We use a "Safe Floor" of 0.3 so the city energy never fully dies
    const urban = Math.max(0.3, (currentRatios.red + currentRatios.grey + currentRatios.yellow) / 3);
    const water = currentRatios.blue;

    // BPM: 50 (Slow/Water) to 140 (Fast/City)
    const targetBPM = 50 + (urban * 90); 
    Tone.Transport.bpm.rampTo(targetBPM, 0.4);

    // NODES: Boost volume so they are the "Lead" instrument
    // release is short in city (0.2s), long in water (12s)
    const nodeRelease = 0.2 + (water * 11.8);
    chimePoly.set({ envelope: { release: nodeRelease } });
    chimePoly.volume.rampTo(-10, 0.2); // Force nodes to be audible

    // NOISE: We reduce this heavily so it doesn't drown the nodes
    // It's now a background 'texture' rather than a wall of sound
    const noiseVol = -65 + (urban * 30) - (water * 20);
    noiseSynth.volume.rampTo(Math.min(-25, noiseVol), 0.5);

    // WATER FLOW: Very subtle
    waterFlow.volume.rampTo(-70 + (water * 30), 1.5);
    masterReverb.wet.rampTo(0.05 + (water * 0.6), 1);
}

// --- 2. REVISED NODE LOOP (GUARANTEED TRIGGER) ---
// Find this inside your startBtn.onclick function
new Tone.Loop(time => {
    // Probability now has a 30% baseline. You will ALWAYS hear nodes.
    const prob = 0.3 + (currentRatios.grey * 0.6);
    
    if (Math.random() < prob) {
        // We pick from high or mid scales based on urban density
        const activeScale = currentRatios.blue > 0.6 ? SCALES.mid : SCALES.high;
        const note = activeScale[Math.floor(Math.random() * activeScale.length)];
        
        // Trigger with a strong velocity (0.8) to pierce the noise
        chimePoly.triggerAttackRelease(note, "32n", time, 0.8);
    }
}, "8n").start(0); // 8th note grid is easier to hear than 16th when slow

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            const limiter = new Tone.Limiter(-1).toDestination();
            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.3 }).connect(limiter);

            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(150, "bandpass").connect(masterReverb));
            noiseSynth.start();

            waterFlow = new Tone.Noise("pink").connect(new Tone.AutoFilter("1n").connect(masterReverb).start());
            waterFlow.start();

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 2,
                envelope: { attack: 0.05, release: 1 }
            }).connect(masterReverb);

            new Tone.Loop(time => {
                const prob = 0.15 + (currentRatios.grey * 0.8);
                if (Math.random() < prob) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time);
                }
            }, "16n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            startBtn.innerText = "PROBE ACTIVE";
            syncProbe();
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
}

window.onload = init;