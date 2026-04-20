const MAP_THEME = {
    HIGHWAY_RED:   "#DC96A2", 
    ROAD_ORANGE:   "#F6D8A9", 
    STREET_YELLOW: "#F8FAC4", 
    STREET_WHITE:  "#FFFFFF",
    HOUSE_GREY:    "#D8D1C9", 
    PARK_GREEN:    "#B4D0A2", 
    WATER_BLUE:    "#B2D2DE"
};

const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"],
    mid: ["G2", "Bb2", "C3", "D3"],
    low: ["C1", "Eb1", "G1"]
};

let map, marker, chimePoly, natureBase, waterPad, masterReverb, noiseSynth, waterFlow;
let isAudioActive = false;
let currentRatios = { red: 0, orange: 0, yellow: 0.2, white: 0.2, grey: 0.2, green: 0, blue: 0 };

function init() {
    // 1. Initialize Map
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false,
        fadeAnimation: false // Helps with visual sync
    }).setView([41.8245, -71.4128], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusVal = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');
    
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    // 2. The Absolute Alignment Function
   function syncProbe() {
    const slider = document.getElementById('radius-slider');
    const frost = document.getElementById('frost-layer');
    const radiusVal = document.getElementById('radius-value');

    const radiusMeters = parseInt(slider.value);
    if (radiusVal) radiusVal.innerText = radiusMeters + "m";

    // 1. GET THE PIN'S ACTUAL SCREEN POSITION
    // This is the "secret sauce" to stop the misalignment.
    const centerLatLng = marker.getLatLng();
    const centerPoint = map.latLngToContainerPoint(centerLatLng);

    // 2. CONVERT METERS TO PIXELS
    const zoom = map.getZoom();
    const lat = centerLatLng.lat;
    const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    const pixelRadius = radiusMeters / metersPerPixel;

    // 3. PUNCH THE HOLE AT THE PIN'S COORDINATES
    const w = window.innerWidth;
    const h = window.innerHeight;

    // We use the centerPoint.x and centerPoint.y we just calculated
    const fullPath = `M 0 0 H ${w} V ${h} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;

    frost.style.clipPath = `path('${fullPath}')`;

    // 4. UPDATE SOUND
    detectFeatures(centerLatLng, radiusMeters);
}

    // 3. Aggregate Sensing (Works at 10,000m)
   function detectFeatures(latlng) {
    const zoom = map.getZoom();
    
    // 1. ZOOM-BASED DENSITY
    // We treat zoom level as the "Complexity" of the map.
    // Boston at Zoom 14 (your screenshot) = Medium-High Energy.
    const zoomFactor = Math.min(1.0, Math.max(0, (zoom - 11) / 7));

    // 2. THE INFRASTRUCTURE SENSOR
    // We assume if you aren't in the deep ocean, you are in a "Built" environment.
    // We sense how close we are to the 'Urban Core' (using Boston/Providence/NYC as anchors)
    const isWater = latlng.lat < 42.34 && latlng.lng > -71.03; // Example: Boston Harbor check
    
    if (zoom < 11 || isWater) {
        currentRatios.blue = 0.9;
        currentRatios.urban = 0.1;
    } else {
        // This is a "Built" environment (Red + Orange + Yellow + Grey)
        currentRatios.urban = zoomFactor * 0.9;
        currentRatios.blue = 1.0 - currentRatios.urban;
    }

    updateAudioEngine();
}

    function updateAudioEngine() {
    if (!isAudioActive) return;

    // A. SNAP-BACK SPEED (BPM)
    // Now scales with the total 'Built' environment.
    // In Boston (high urban), BPM hits 145. In the Harbor, it drops to 25.
    const targetBPM = 25 + (currentRatios.urban * 120);
    Tone.Transport.bpm.rampTo(targetBPM, 0.3); // Very fast 'snap' for responsive feel

    // B. NODE EXTENSION (Ocean Release)
    // City = 0.15s (Machine-like) | Water = 18s (Ghostly)
    const nodeRelease = 0.15 + (currentRatios.blue * 17.85);
    chimePoly.set({ 
        envelope: { 
            attack: 0.005 + (currentRatios.blue * 1.5),
            release: nodeRelease 
        } 
    });

    // C. ROAD RESONANCE (The Industrial Hum)
    // Increases the distortion and volume when in the Urban zone
    const industrialGain = -55 + (currentRatios.urban * 40);
    noiseSynth.volume.rampTo(Math.min(-15, industrialGain), 0.2);
    
    // D. REVERB MUSH
    // Dries out in the city for clarity; gets cloudy in the water
    masterReverb.wet.rampTo(0.05 + (currentRatios.blue * 0.8), 0.5);
}

    // 4. Tone.js Initialization
    startBtn.onclick = async () => {
        try {
            await Tone.start();
            const limiter = new Tone.Limiter(-1).toDestination();
            masterReverb = new Tone.Reverb({ decay: 15, wet: 0.3 }).connect(limiter);

            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(100, "bandpass").connect(masterReverb));
            noiseSynth.start();

            waterFlow = new Tone.Noise("pink").connect(new Tone.AutoFilter("1n").connect(masterReverb).start());
            waterFlow.start();

            natureBase = new Tone.MonoSynth({
                oscillator: { type: "fatsawtooth", count: 3 },
                envelope: { attack: 3, release: 12 }
            }).connect(new Tone.Filter(60, "lowpass").connect(masterReverb));

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 2,
                envelope: { attack: 0.05, release: 1 }
            }).connect(masterReverb);

            new Tone.Loop(time => {
            // Probability is almost 100% in dense urban areas
            const spawnProb = 0.1 + (currentRatios.urban * 0.85);
    
            if (Math.random() < spawnProb) {
            const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
            chimePoly.triggerAttackRelease(note, "64n", time);
            }
            }, "16n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            startBtn.innerText = "PROBE ACTIVE";
            syncProbe();
        } catch (e) { console.error(e); }
    };

    // Listeners for real-time alignment
    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);

    // Initial Sync
    setTimeout(syncProbe, 100);
}

window.onload = init;