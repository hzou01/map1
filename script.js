// 1. THE MAP THEME (Logic Targets)
const MAP_THEME = {
    HIGHWAY_RED:   "#DC96A2", 
    ROAD_ORANGE:   "#F6D8A9", 
    STREET_YELLOW: "#F8FAC4", 
    STREET_WHITE:  "#FFFFFF",
    HOUSE_GREY:    "#D8D1C9", 
    PARK_GREEN:    "#B4D0A2", 
    WATER_BLUE:    "#B2D2DE"
};

let map, marker, chimePoly, natureBase, waterPad, masterReverb, noiseSynth;
let isAudioActive = false;

// The "Brain" of the detection - updated by the probe content
let currentRatios = { red: 0, orange: 0, yellow: 0, white: 0, grey: 0, green: 0, blue: 0 };

const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"], 
    mid: ["G2", "Bb2", "C3", "D3"],        
    low: ["C1", "Eb1", "G1"]               
};

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusVal = document.getElementById('radius-value'); // UI element to show number
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    // REAL-TIME PROBE SCAN
    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        if(radiusVal) radiusVal.innerText = radiusMeters + "m"; // Update UI number

        const center = marker.getLatLng();
        
        // --- TRUE DETECTION LOGIC ---
        // In a real-world scenario, we fetch features within the radius
        // Here we simulate the sensor reading the map's metadata
        detectFeaturesInsideProbe(center, radiusMeters);

        // Visual update
        const centerPoint = map.latLngToContainerPoint(center);
        const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = radiusMeters / metersPerPixel;

        const holeX = centerPoint.x + 100; 
        const holeY = centerPoint.y + 100;
        const fullPath = `M 0 0 H ${window.innerWidth + 200} V ${window.innerHeight + 200} H 0 Z M ${holeX} ${holeY} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;
        
        updateAudioEngine();
    }

    function detectFeaturesInsideProbe(latlng, radius) {
        // This function simulates the "#ChromaKey" or "#Analyze" node.
        // It calculates how much of the "Probe Area" is covered by specific features.
        // As you move near the Providence River, 'blue' increases.
        // As you move toward I-95, 'red' increases.
        
        const distFromWater = latlng.distanceTo([41.82, -71.40]); // Near the river
        currentRatios.blue = Math.max(0, 1 - (distFromWater / 1000));
        
        const distFromPark = latlng.distanceTo([41.828, -71.41]); // Near Prospect Terrace
        currentRatios.green = Math.max(0, 1 - (distFromPark / 800));

        const distFromHighway = latlng.distanceTo([41.818, -71.415]); // Near I-95
        currentRatios.red = Math.max(0, 1 - (distFromHighway / 500));

        // Fill the rest with Urban (Grey/Yellow)
        currentRatios.grey = 0.5 - (currentRatios.green * 0.5);
        currentRatios.yellow = 0.5 - (currentRatios.blue * 0.5);
    }

    function updateAudioEngine() {
        if (!isAudioActive) return;

        // TEMPORAL DRAG: Water slows the world down
        const tempo = 110 - (currentRatios.blue * 70); 
        Tone.Transport.bpm.rampTo(tempo, 0.5);

        // INDUSTRIAL RESONANCE: Roads add noise
        const roadPresence = currentRatios.red + currentRatios.orange;
        noiseSynth.volume.rampTo(-45 + (roadPresence * 30), 0.5);
        
        // SOFT TONAL BASE: Parks make it mushy and deep
        natureBase.volume.rampTo(-35 + (currentRatios.green * 28), 1);
        
        // NODE POP-OUT: More houses = more nodes
        const urbanDensity = currentRatios.grey + currentRatios.yellow + currentRatios.white;
        chimePoly.volume.rampTo(-22 + (urbanDensity * 18), 0.2);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            const limiter = new Tone.Limiter(-2).toDestination();
            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.2 }).connect(limiter);

            // 1. Industrial Noise
            noiseSynth = new Tone.Noise("pink").connect(new Tone.Filter(400, "bandpass").connect(masterReverb));
            noiseSynth.volume.value = -50;
            noiseSynth.start();

            // 2. Soft Nature Drone
            natureBase = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "fatsine4" },
                envelope: { attack: 3, release: 12 }
            }).connect(new Tone.Filter(70, "lowpass").connect(masterReverb));

            // 3. Urban Node Chimes
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 2,
                envelope: { attack: 0.02, decay: 0.1, release: 1 }
            }).connect(masterReverb);

            // 4. Water Pad
            waterPad = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 4, release: 10 }
            }).connect(masterReverb);

            new Tone.Loop(time => {
                const urbanDensity = currentRatios.grey + currentRatios.yellow + currentRatios.white;
                // High frequency of small nodes
                if (Math.random() < (0.1 + urbanDensity * 0.7)) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time);
                }

                if (Tone.Transport.getTicksAtTime(time) % Tone.Ticks("1n").toNumber() === 0) {
                    // Trigger the Long, Deep Base
                    const bNote = SCALES.low[Math.floor(Math.random() * SCALES.low.length)];
                    natureBase.triggerAttackRelease(bNote, "1n", time);
                }
            }, "16n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            startBtn.innerText = "PROBE ACTIVE";
            syncProbe();
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe; // Updates real-time as you drag the slider
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
}

window.onload = init;