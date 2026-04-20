// 1. THE THEME & SCALES
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
let currentRatios = { red: 0, orange: 0, yellow: 0.1, white: 0.1, grey: 0.1, green: 0, blue: 0 };

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusVal = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        if(radiusVal) radiusVal.innerText = radiusMeters + "m";

        const center = marker.getLatLng();
        detectFeatures(center);

        const centerPoint = map.latLngToContainerPoint(center);
        const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = radiusMeters / metersPerPixel;

        // Visual fix: Ensure the hole is centered exactly on the marker
        const fullPath = `M 0 0 H ${window.innerWidth + 500} V ${window.innerHeight + 500} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;
        
        updateAudioEngine();
    }

    function detectFeatures(latlng) {
    const slider = document.getElementById('radius-slider');
    const currentRadius = parseInt(slider.value);
    
    // The "Sensing Range" now grows with your probe radius
    // This prevents the sound from 'snapping' back to urban defaults at large scales
    const sensingRange = Math.max(currentRadius * 1.5, 2000);

    // WATER: Deep Harbor/Bay
    const toWater = latlng.distanceTo([41.81, -71.39]); 
    currentRatios.blue = Math.max(0, 1 - (toWater / (sensingRange * 1.2)));

    // FOREST/PARKS: Mountains & Soft Greenery
    const toPark = latlng.distanceTo([41.83, -71.41]); 
    currentRatios.green = Math.max(0, 1 - (toPark / sensingRange));

    // INDUSTRIAL: Roads & Resonance
    const toRoad = latlng.distanceTo([41.818, -71.415]);
    currentRatios.red = Math.max(0, 1 - (toRoad / (sensingRange * 0.5)));

    // URBAN: Pop-out Density
    // Residential (Grey) and Streets (White) fill the gaps
    const natureDominance = currentRatios.blue + currentRatios.green;
    currentRatios.grey = Math.max(0.1, 0.5 - natureDominance);
    currentRatios.white = Math.max(0.1, 0.5 - natureDominance);
}

    function updateAudioEngine() {
    if (!isAudioActive) return;

    // --- TEMPORAL DRAG ---
    // If Blue is 1.0, BPM drops to 25. If Blue is 0.0, BPM is 120.
    const dragMultiplier = Math.pow(currentRatios.blue, 2); // Exponential curve for 'heavy' feel
    const targetBPM = 120 - (dragMultiplier * 95) - (currentRatios.green * 40);
    
    // Constrain BPM to a minimum of 20 so it doesn't stop entirely
    Tone.Transport.bpm.rampTo(Math.max(20, targetBPM), 1.5);

    // --- SYMPHONIC PROLONGING ---
    // Increases the "Tail" of the notes based on Water/Green
    const tailLength = 1 + (currentRatios.blue * 18) + (currentRatios.green * 10);
    
    // Map features to specific sound effects
    waterPad.set({ envelope: { release: tailLength } });
    natureBase.set({ envelope: { release: tailLength * 1.2 } });
    
    // Industrial Noise (Red/Orange)
    const industrialGain = -60 + (currentRatios.red * 45);
    noiseSynth.volume.rampTo(industrialGain, 1);

    // Soothing Water Flow (Blue)
    const waterGain = -55 + (currentRatios.blue * 30);
    waterFlow.volume.rampTo(waterGain, 2);
}

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            const limiter = new Tone.Limiter(-2).toDestination();
            masterReverb = new Tone.Reverb({ decay: 15, wet: 0.2 }).connect(limiter);

            // Industrial Noise
            const crush = new Tone.BitCrusher(4).connect(masterReverb);
            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(150, "bandpass").connect(crush));
            noiseSynth.start();

            // Water Soothe
            waterFlow = new Tone.Noise("pink").connect(new Tone.AutoFilter("2n").connect(masterReverb).start());
            waterFlow.start();

            // Heavy Bass
            natureBase = new Tone.MonoSynth({
                oscillator: { type: "fatsawtooth", count: 3 },
                envelope: { attack: 2, release: 10 }
            }).connect(new Tone.Filter(65, "lowpass").connect(masterReverb));

            // Urban Nodes
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 3,
                envelope: { attack: 0.01, release: 1.5 }
            }).connect(masterReverb);

            waterPad = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 4, release: 12 }
            }).connect(masterReverb);

            // THE LOOP
            new Tone.Loop(time => {
                const urbanDensity = currentRatios.grey + currentRatios.yellow;
                if (Math.random() < (0.1 + urbanDensity * 0.7)) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time);
                }

                if (Tone.Transport.getTicksAtTime(time) % Tone.Ticks("1n").toNumber() === 0) {
                    const bNote = SCALES.low[Math.floor(Math.random() * SCALES.low.length)];
                    natureBase.triggerAttackRelease(bNote, "1n", time);
                }
            }, "16n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            startBtn.innerText = "SYSTEM ONLINE";
            syncProbe(); // Run immediately on start
        } catch (e) { console.error(e); }
    };

    // Listeners for real-time sync
    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);

    // CALL ONCE ON INITIAL LOAD
    setTimeout(syncProbe, 500); 
}

window.onload = init;