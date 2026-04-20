// 1. THE EXACT COLOR PALETTE
const MAP_THEME = {
    HIGHWAY_RED:   "#DC96A2", // Major Interchanges
    ROAD_ORANGE:   "#F6D8A9", // Main Arteries / Connectors
    STREET_YELLOW: "#F8FAC4", // Local City Grid
    HOUSE_GREY:    "#D8D1C9", // Residential
    PARK_GREEN:    "#B4D0A2", // Nature/Cemeteries
    WATER_BLUE:    "#B2D2DE"  // Rivers/Harbor
};

// 2. THE AUDIO STATE
let map, marker, chimePoly, natureBase, waterPad, masterReverb;
let isAudioActive = false;

// Updated Ratios to include Orange
let currentRatios = { red: 0, orange: 0, yellow: 0.2, grey: 0.2, green: 0.2, blue: 0.4 };

const SCALES = {
    high: ["C5", "Eb5", "G5", "Bb5", "C6"],
    mid: ["G3", "Bb3", "C4"], 
    low: ["C1", "G1"]         
};

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

    // 3. THE SYMPHONIC MIXER
    function updateAudioEngine() {
        if (!isAudioActive) return;

        // URBAN SPEED: Yellow is base city speed, Orange/Red are high-speed transit
        const roadSpeed = (currentRatios.red * 2.0) + (currentRatios.orange * 1.5) + currentRatios.yellow;
        const tempo = 75 + (roadSpeed * 125); 
        Tone.Transport.bpm.rampTo(tempo, 1);
        
        // Volume of Chimes
        chimePoly.volume.rampTo(-15 + (roadSpeed * 12), 0.5);

        // WATER CLOUDINESS (Blue)
        masterReverb.wet.rampTo(0.05 + (currentRatios.blue * 0.85), 1.5);
        waterPad.volume.rampTo(-30 + (currentRatios.blue * 25), 1.5);

        // MUSHY BASS (Green)
        natureBase.volume.rampTo(-40 + (currentRatios.green * 35), 1.5);
    }

    // 4. AUDIO INITIALIZATION
    startBtn.onclick = async () => {
        try {
            await Tone.start();

            masterReverb = new Tone.Reverb({ decay: 12, wet: 0.1 }).toDestination();

            // High Chimes: FM Synth for that metallic/glassy feel
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 2.5,
                envelope: { attack: 0.05, release: 1.5 }
            }).connect(masterReverb);

            // Mid Pad: Triangle wave for "Medium" tonality
            waterPad = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 4, release: 12 }
            }).connect(masterReverb);

            // Low Base: MonoSynth ensures it never stops or gets "stolen"
            const lowFilter = new Tone.Filter(85, "lowpass").connect(masterReverb);
            natureBase = new Tone.MonoSynth({
                oscillator: { type: "sine" },
                envelope: { attack: 2, release: 8 }
            }).connect(lowFilter);

            // GENERATIVE LOOP
            new Tone.Loop(time => {
                // High-speed Urban Pings (Yellow/Orange/Red)
                const urbanProb = 0.1 + (currentRatios.yellow * 0.6) + (currentRatios.orange * 0.3);
                if (Math.random() < urbanProb) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time);
                }

                // Base & Mid Foundation (Steady 2n pulse)
                if (Tone.Transport.getTicksAtTime(time) % Tone.Ticks("2n").toNumber() === 0) {
                    if (Math.random() < (currentRatios.green + 0.3)) {
                        const bNote = SCALES.low[Math.floor(Math.random() * SCALES.low.length)];
                        natureBase.triggerAttackRelease(bNote, "1n", time);
                    }
                    if (Math.random() < (currentRatios.blue + 0.3)) {
                        const mNote = SCALES.mid[Math.floor(Math.random() * SCALES.mid.length)];
                        waterPad.triggerAttackRelease(mNote, "1n", time);
                    }
                }
            }, "8n").start(0);

            Tone.Transport.start();
            startBtn.innerText = "PROBE ACTIVE";
            isAudioActive = true;
            syncProbe();
        } catch (err) { console.error(err); }
    };

    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);

    // Simulated ChromaKey detection on release
    marker.on('dragend', () => {
        currentRatios.red = Math.random() * 0.3;
        currentRatios.orange = Math.random() * 0.5; // New Orange Detection
        currentRatios.yellow = Math.random() * 0.7;
        currentRatios.green = Math.random(); 
        currentRatios.blue = Math.random();
        syncProbe();
    });

    setTimeout(syncProbe, 100);
}

window.onload = init;