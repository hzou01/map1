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
    function detectFeatures(latlng, radius) {
        // Sensing distance scales with probe size
        const senseScale = Math.max(radius, 2000);

        const toWater = latlng.distanceTo([41.815, -71.395]); 
        const toPark = latlng.distanceTo([41.831, -71.415]); 
        const toRoad = latlng.distanceTo([41.818, -71.418]);

        currentRatios.blue = Math.max(0, 1 - (toWater / (senseScale * 1.5)));
        currentRatios.green = Math.max(0, 1 - (toPark / senseScale));
        currentRatios.red = Math.max(0, 1 - (toRoad / (senseScale * 0.4)));

        // Aggressive Temporal Drag Variables
        updateAudioEngine();
    }

    function updateAudioEngine() {
        if (!isAudioActive) return;

        // THE SLOWDOWN: Exponential Drag
        // If blue is high, drag pulls BPM from 120 down to 15
        const drag = Math.pow(currentRatios.blue, 1.5) + (currentRatios.green * 0.5);
        const targetBPM = 120 - (drag * 105);
        Tone.Transport.bpm.rampTo(Math.max(15, targetBPM), 1);

        // THE PROLONG: Increase release based on nature
        const stretch = 1 + (currentRatios.blue * 20);
        chimePoly.set({ envelope: { release: stretch * 0.5 } });
        natureBase.set({ envelope: { release: stretch * 2 } });

        // VOLUMES
        noiseSynth.volume.rampTo(-60 + (currentRatios.red * 40), 0.5);
        waterFlow.volume.rampTo(-55 + (currentRatios.blue * 35), 1);
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
                if (Math.random() < 0.6) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time);
                }
                if (Tone.Transport.getTicksAtTime(time) % Tone.Ticks("1n").toNumber() === 0) {
                    natureBase.triggerAttackRelease(SCALES.low[0], "1n", time);
                }
            }, "8n").start(0);

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