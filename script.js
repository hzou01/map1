// 1. UPDATED THEME & SCALES
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
    high: ["C5", "D5", "G5", "A5", "C6"],
    mid: ["C3", "E3", "G3", "B3"],
    low: ["C1", "G1", "F1"] // Deep, "mountainous" anchors
};

let map, marker, chimePoly, natureBase, waterPad, masterReverb, noiseSynth;
let isAudioActive = false;
let currentRatios = { red: 0.1, orange: 0.1, yellow: 0.2, white: 0.2, grey: 0.2, green: 0.1, blue: 0.1 };

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        const centerPoint = map.latLngToContainerPoint(marker.getLatLng());
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = radiusMeters / metersPerPixel;

        const holeX = centerPoint.x + 100; 
        const holeY = centerPoint.y + 100;
        const fullPath = `M 0 0 H ${window.innerWidth + 200} V ${window.innerHeight + 200} H 0 Z M ${holeX} ${holeY} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;
        
        updateAudioEngine();
    }

    function updateAudioEngine() {
        if (!isAudioActive) return;

        // WATER: "Slow down the rhythm"
        // Base BPM is 120, drops toward 40 in deep blue areas
        const tempo = 120 - (currentRatios.blue * 80);
        Tone.Transport.bpm.rampTo(tempo, 1.5);
        masterReverb.wet.rampTo(0.1 + (currentRatios.blue * 0.8), 1.5);

        // ROADS/INDUSTRIAL: "Stronger resonance and noise"
        const roadPresence = currentRatios.red + currentRatios.orange;
        noiseSynth.volume.rampTo(-40 + (roadPresence * 30), 1);
        
        // PARKS: "Softer tones"
        natureBase.volume.rampTo(-30 + (currentRatios.green * 25), 2);
        
        // DENSE REGIONS: "More nodes pop out"
        const urbanDensity = currentRatios.grey + currentRatios.yellow + currentRatios.white;
        chimePoly.volume.rampTo(-20 + (urbanDensity * 15), 0.5);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();

            // FX CHAIN
            const limiter = new Tone.Limiter(-1).toDestination();
            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.2 }).connect(limiter);

            // 1. INDUSTRIAL NOISE (Roads)
            // A band-passed noise to simulate traffic/wind
            const noiseFilter = new Tone.AutoFilter("4n").connect(masterReverb).start();
            noiseSynth = new Tone.Noise("pink").connect(noiseFilter);
            noiseSynth.volume.value = -50;
            noiseSynth.start();

            // 2. SOFT DRONE (Parks/Mountains)
            const lowFilter = new Tone.Filter(60, "lowpass").connect(masterReverb);
            natureBase = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 4, release: 12 }
            }).connect(lowFilter);

            // 3. URBAN NODES (Houses/Streets)
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 3,
                modulationIndex: 10,
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.05, release: 0.8 }
            }).connect(masterReverb);

            // 4. WATER TEXTURE (Mid-layer)
            waterPad = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 5, release: 10 }
            }).connect(masterReverb);

            // GENERATIVE SCORE
            new Tone.Loop(time => {
                const urbanDensity = currentRatios.grey + currentRatios.yellow + currentRatios.white;
                
                // Urban "Pop-outs"
                if (Math.random() < (0.05 + urbanDensity * 0.8)) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time);
                }

                // Sub-Base Pulse (Steady)
                if (Tone.Transport.getTicksAtTime(time) % Tone.Ticks("1n").toNumber() === 0) {
                    const bNote = SCALES.low[Math.floor(Math.random() * SCALES.low.length)];
                    natureBase.triggerAttackRelease(bNote, "1n", time);
                    
                    const mNote = SCALES.mid[Math.floor(Math.random() * SCALES.mid.length)];
                    waterPad.triggerAttackRelease(mNote, "2n", time);
                }
            }, "16n").start(0);

            Tone.Transport.start();
            startBtn.innerText = "PROBE ACTIVE";
            isAudioActive = true;
            syncProbe();
        } catch (err) { console.error(err); }
    };

    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);
    marker.on('dragend', () => {
        // Simulated Chromakey Scan for Providence
        currentRatios.red = Math.random() * 0.3;
        currentRatios.orange = Math.random() * 0.4;
        currentRatios.yellow = Math.random() * 0.5;
        currentRatios.white = Math.random() * 0.5;
        currentRatios.grey = Math.random() * 0.6;
        currentRatios.green = Math.random(); 
        currentRatios.blue = Math.random();
        syncProbe();
    });

    setTimeout(syncProbe, 100);
}

window.onload = init;