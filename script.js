// 1. COLORS & SCALES
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
    low: ["C1", "Eb1", "G1"] // Very deep anchors
};

let map, marker, chimePoly, natureBase, waterPad, masterReverb, noiseSynth, waterFlow;
let isAudioActive = false;
let currentRatios = { red: 0, orange: 0, yellow: 0, white: 0, grey: 0, green: 0, blue: 0 };

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

        const fullPath = `M 0 0 H ${window.innerWidth + 200} V ${window.innerHeight + 200} H 0 Z M ${centerPoint.x + 100} ${centerPoint.y + 100} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;
        
        updateAudioEngine();
    }

    function detectFeatures(latlng) {
        // Precise location targets for Providence
        const toWater = latlng.distanceTo([41.82, -71.40]);
        currentRatios.blue = Math.max(0, 1 - (toWater / 1200));

        const toPark = latlng.distanceTo([41.828, -71.41]);
        currentRatios.green = Math.max(0, 1 - (toPark / 900));

        const toRoad = latlng.distanceTo([41.818, -71.415]);
        currentRatios.red = Math.max(0, 1 - (toRoad / 600));

        currentRatios.grey = 0.4 - (currentRatios.green * 0.3);
        currentRatios.white = 0.5 - (currentRatios.blue * 0.4);
    }

    function updateAudioEngine() {
        if (!isAudioActive) return;

        // WATER: Flowing & Slow Rhythm
        const tempo = 110 - (currentRatios.blue * 75);
        Tone.Transport.bpm.rampTo(tempo, 1);
        waterFlow.volume.rampTo(-45 + (currentRatios.blue * 25), 1.5);
        masterReverb.wet.rampTo(0.1 + (currentRatios.blue * 0.7), 1.5);

        // ROADS: Industrial Resonance
        const roadPresence = currentRatios.red + currentRatios.orange;
        noiseSynth.volume.rampTo(-45 + (roadPresence * 30), 0.5);

        // NATURE: Deep Heavy Bass
        natureBase.volume.rampTo(-28 + (currentRatios.green * 25), 1.2);
        
        // CITIES: Fast nodes
        const urbanDensity = currentRatios.grey + currentRatios.white;
        chimePoly.volume.rampTo(-24 + (urbanDensity * 18), 0.3);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            const limiter = new Tone.Limiter(-2).toDestination();
            masterReverb = new Tone.Reverb({ decay: 12, wet: 0.2 }).connect(limiter);

            // 1. INDUSTRIAL NOISE (Highway Resonance)
            const crush = new Tone.BitCrusher(4).connect(masterReverb);
            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(120, "bandpass").connect(crush));
            noiseSynth.volume.value = -50;
            noiseSynth.start();

            // 2. WATER FLOW (The "Soothe" Base)
            // Lapping water effect using low-pass noise
            const waterFilter = new Tone.AutoFilter("2n").connect(masterReverb).start();
            waterFlow = new Tone.Noise("pink").connect(waterFilter);
            waterFlow.volume.value = -60;
            waterFlow.start();

            // 3. HEAVY BASS (Mountain/Park Anchor)
            natureBase = new Tone.MonoSynth({
                oscillator: { type: "fatsawtooth", count: 3, spread: 30 },
                envelope: { attack: 2, decay: 4, sustain: 0.8, release: 12 }
            }).connect(new Tone.Filter(60, "lowpass").connect(masterReverb));

            // 4. URBAN NODES
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 3,
                envelope: { attack: 0.01, decay: 0.2, release: 1 }
            }).connect(masterReverb);

            new Tone.Loop(time => {
                const urbanDensity = currentRatios.grey + currentRatios.white;
                if (Math.random() < (0.1 + urbanDensity * 0.75)) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time);
                }

                if (Tone.Transport.getTicksAtTime(time) % Tone.Ticks("1n").toNumber() === 0) {
                    // Deep heavy anchor pulse
                    const bNote = SCALES.low[Math.floor(Math.random() * SCALES.low.length)];
                    natureBase.triggerAttackRelease(bNote, "1.5n", time);
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