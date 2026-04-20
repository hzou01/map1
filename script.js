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
        // PROVIDENCE MAPPING SENSORS
        const toWater = latlng.distanceTo([41.8200, -71.4044]); // River
        currentRatios.blue = Math.max(0, 1 - (toWater / 1000));

        const toPark = latlng.distanceTo([41.8282, -71.4125]); // Prospect Terrace
        currentRatios.green = Math.max(0, 1 - (toPark / 800));

        const toHighway = latlng.distanceTo([41.8185, -71.4188]); // I-95
        currentRatios.red = Math.max(0, 1 - (toHighway / 600));

        // Urban balance
        currentRatios.grey = 0.3;
        currentRatios.yellow = 0.3;
    }

    function updateAudioEngine() {
        if (!isAudioActive) return;

        // --- TEMPORAL DRAG (The Slowdown) ---
        // Blue (Water) and Green (Forest) drastically cut the BPM
        const drag = (currentRatios.blue * 0.7) + (currentRatios.green * 0.4);
        const targetBPM = 120 - (drag * 90); // Ramps down from 120 to 30 BPM
        Tone.Transport.bpm.rampTo(targetBPM, 0.5);

        // --- PROLONGING (Envelope Stretch) ---
        const stretch = 1 + (currentRatios.blue * 15) + (currentRatios.green * 8);
        waterPad.set({ envelope: { release: stretch } });
        natureBase.set({ envelope: { release: stretch * 1.5 } });

        // --- INDUSTRIAL NOISE ---
        const roadPresence = currentRatios.red + currentRatios.orange;
        noiseSynth.volume.rampTo(-45 + (roadPresence * 35), 0.5);

        // --- WATER SOOTHE ---
        waterFlow.volume.rampTo(-50 + (currentRatios.blue * 30), 1);
        masterReverb.wet.rampTo(0.1 + (currentRatios.blue * 0.8), 1);
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