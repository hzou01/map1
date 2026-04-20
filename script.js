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

let map, marker, chimePoly, noiseSynth, masterReverb;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.5 };

function init() {
    // 1. Initialize Map & Marker
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false,
        fadeAnimation: false 
    }).setView([42.345, -71.07], 14); // Boston View
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusVal = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');
    
    marker = L.marker([42.345, -71.07], { draggable: true }).addTo(map);

    // 2. The Absolute Alignment Function
    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        if (radiusVal) radiusVal.innerText = radiusMeters + "m";

        const centerLatLng = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(centerLatLng);

        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;

        const w = window.innerWidth;
        const h = window.innerHeight;

        const fullPath = `M 0 0 H ${w} V ${h} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;

        frost.style.clipPath = `path('${fullPath}')`;

        // SENSOR: Using Zoom as a reliable Universal Proxy
        let intensity = Math.min(1.0, Math.max(0.1, (zoom - 11) / 7));
        currentRatios.urban = intensity;
        currentRatios.blue = 1.0 - intensity;

        if (isAudioActive) updateAudioEngine();
    }

    function updateAudioEngine() {
        const urban = currentRatios.urban;
        const blue = currentRatios.blue;

        // BPM: 40 (Nature) to 140 (City)
        Tone.Transport.bpm.rampTo(40 + (urban * 100), 0.3);

        // NODES: Ensure they are LOUD and Clear
        chimePoly.volume.value = -4; 
        const nodeRelease = 0.2 + (blue * 10);
        chimePoly.set({ envelope: { release: nodeRelease } });

        // NOISE: Keep it as a background texture
        const noiseVol = -60 + (urban * 30);
        noiseSynth.volume.rampTo(noiseVol, 0.5);
    }

    // 3. Audio Initialization
    startBtn.onclick = async () => {
        try {
            await Tone.start();
            
            // Reverb for atmosphere
            masterReverb = new Tone.Reverb({ decay: 6, wet: 0.2 }).toDestination();

            // CHIMES: Triangle wave is more audible than Sine
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "fatsine4" },
                envelope: { attack: 0.01, release: 1 }
            }).connect(masterReverb);

            // INDUSTRIAL NOISE: Filtered brown noise
            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(250, "lowpass").toDestination());
            noiseSynth.start();

            // GUARANTEED HEARTBEAT LOOP
            new Tone.Loop(time => {
                const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                // Force triggering every 8th note for testing
                chimePoly.triggerAttackRelease(note, "16n", time, 0.8);
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            startBtn.innerText = "PROBE ACTIVE";
            updateAudioEngine();
        } catch (e) { console.error("Audio Error:", e); }
    };

    // Listeners
    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);

    // FIX: Force the circle to draw immediately after Map is ready
    map.whenReady(() => {
        setTimeout(syncProbe, 150);
    });
}

window.onload = init;