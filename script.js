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
    
    // Normalize zoom: 12 is 'Natural', 18 is 'Heavy Urban'
    let zoomDensity = Math.min(1.0, Math.max(0, (zoom - 11) / 7));
    
    // Check for water specifically in the coordinates
    const toWater = latlng.distanceTo([42.35, -71.05]); // Generic 'Water' anchor
    const waterSense = Math.max(0, 1 - (toWater / 5000));

    // Balanced Ratios
    currentRatios.urban = Math.max(0.1, zoomDensity - (waterSense * 0.5));
    currentRatios.blue = Math.max(0.1, waterSense + (1.0 - zoomDensity) * 0.5);

    updateAudioEngine();
}

    function updateAudioEngine() {
    if (!isAudioActive) return;

    const urban = currentRatios.urban || 0.1; // Fallback to 0.1
    const water = currentRatios.blue || 0.1;

    // A. REGAIN THE NODES (BPM)
    const targetBPM = 30 + (urban * 110);
    Tone.Transport.bpm.rampTo(targetBPM, 0.4);

    // B. FREQUENCY SEPARATION
    // In the city, we push the industrial noise higher (Thin/Crunchy)
    // In nature, it stays low (Rumble)
    const noiseFilterFreq = 100 + (urban * 800);
    noiseSynth.filter.frequency.rampTo(noiseFilterFreq, 0.5);

    // C. NODE VOLUME BOOST
    // If urban is high, we make the chimes louder to compete with the roads
    chimePoly.volume.rampTo(-20 + (urban * 15), 0.3);

    // D. EXTENSION (Prolonging)
    const releaseTime = 0.2 + (water * 15);
    chimePoly.set({ envelope: { release: releaseTime } });

    // E. INDUSTRIAL MUTE IN WATER
    // This ensures the noise stops when you are in the ocean/river
    const noiseVol = -60 + (urban * 45) - (water * 30);
    noiseSynth.volume.rampTo(Math.min(-18, noiseVol), 0.4);
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
            // We add a '0.15' floor so you ALWAYS hear some nodes
            const spawnProb = 0.15 + (currentRatios.urban * 0.8);
    
        if (Math.random() < spawnProb) {
        // In the city, nodes are higher pitched; in nature, they drop an octave
        const scale = currentRatios.urban > 0.5 ? SCALES.high : SCALES.mid;
        const note = scale[Math.floor(Math.random() * scale.length)];
        
        // Velocity (loudness) now fights the industrial noise
        const velocity = 0.4 + (currentRatios.urban * 0.5);
        chimePoly.triggerAttackRelease(note, "32n", time, velocity);
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