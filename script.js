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

let map, marker, chimePoly, natureBase, noiseSynth, waterFlow, masterReverb;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, red: 0.1 };

function init() {
    // 1. Setup Map - Set to Boston coordinates from your screenshot
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false 
    }).setView([42.345, -71.07], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusVal = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');
    
    marker = L.marker([42.345, -71.07], { draggable: true }).addTo(map);

    // 2. The Alignment Logic
    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        if(radiusVal) radiusVal.innerText = radiusMeters + "m";

        const center = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(center);
        
        const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = radiusMeters / metersPerPixel;

        const w = window.innerWidth;
        const h = window.innerHeight;
        
        const fullPath = `M 0 0 H ${w} V ${h} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        
        frost.style.clipPath = `path('${fullPath}')`;
        detectFeatures(center);
    }

    // 3. The Universal Sensor Logic (Boston/NYC/Providence)
    function detectFeatures(latlng) {
        const zoom = map.getZoom();
        
        // Use Zoom + Distance to generalize 'Urban' vs 'Water'
        // High zoom = more city streets. Low zoom = more open space.
        let density = Math.min(1.0, Math.max(0.1, (zoom - 11) / 7));
        
        // Approximate Water Check (e.g., Boston Harbor / Providence River)
        const isNearWater = latlng.lng > -71.04 || latlng.lat < 41.81;
        
        currentRatios.urban = isNearWater ? density * 0.3 : density;
        currentRatios.blue = 1.0 - currentRatios.urban;

        updateAudioEngine();
    }

    function updateAudioEngine() {
        if (!isAudioActive) return;

        const urban = currentRatios.urban;
        const blue = currentRatios.blue;

        // A. TEMPORAL DRAG (BPM)
        // City = 140 BPM | Water = 20 BPM
        const targetBPM = 20 + (urban * 120);
        Tone.Transport.bpm.rampTo(targetBPM, 0.5);

        // B. SYMPHONIC PROLONGING (Release)
        // Stretch notes up to 18 seconds in the water
        const stretch = 0.2 + (blue * 17.8);
        chimePoly.set({ 
            envelope: { release: stretch },
            harmonicity: 1 + (urban * 2) 
        });

        // C. INDUSTRIAL NOISE VOLUME
        // Ducks volume when in nature
        const noiseVol = -55 + (urban * 40) - (blue * 15);
        noiseSynth.volume.rampTo(Math.min(-18, noiseVol), 0.3);

        // D. REVERB CLOUD
        masterReverb.wet.rampTo(0.05 + (blue * 0.8), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            
            // Reverb for the 'Ocean' effect
            masterReverb = new Tone.Reverb({ decay: 15, wet: 0.1 }).toDestination();
            
            // 1. THE NODES (Connected to reverb)
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, release: 1 }
            }).connect(masterReverb);

            // 2. INDUSTRIAL HUM
            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(200, "lowpass").toDestination());
            noiseSynth.start();

            // 3. THE HEARTBEAT LOOP
            // This loop never dies. It triggers every 8th note.
            new Tone.Loop(time => {
                const prob = 0.2 + (currentRatios.urban * 0.7);
                if (Math.random() < prob) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time, 0.7);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            startBtn.innerText = "SYSTEM ONLINE";
            syncProbe();
        } catch (e) { console.error("Audio Load Error:", e); }
    };

    // Listeners
    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
    
    // Initial Sync
    setTimeout(syncProbe, 500);
}

window.onload = init;