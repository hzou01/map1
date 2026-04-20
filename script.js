// 1. THE EXACT COLOR PALETTE (Updated with your Hex codes)
const MAP_THEME = {
    HIGHWAY_RED:   "#DC96A2", 
    ROAD_ORANGE:   "#F6D8A9", 
    STREET_YELLOW: "#F8FAC4", 
    HOUSE_GREY:    "#D8D1C9", 
    PARK_GREEN:    "#B4D0A2", 
    WATER_BLUE:    "#B2D2DE",
    STREET_WHITE:  "#FFFFFF"  // Added White for streets
};

// 2. THE AUDIO STATE
let map, marker, chimePoly, natureBase, waterPad, masterReverb;
let isAudioActive = false;

let currentRatios = { red: 0, orange: 0, yellow: 0.2, white: 0.1, grey: 0.2, green: 0.2, blue: 0.2 };

// UPDATED SCALES: Lower octaves for a heavier feel
const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"], // Lowered from C5/C6
    mid: ["G2", "Bb2", "C3", "D3"],        // Stretched medium tones
    low: ["C1", "Eb1", "G1"]               // Deep, heavy bass anchors
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

        // URBAN SPEED & DENSITY: Grey (Houses) and White/Yellow (Streets)
        const urbanDensity = currentRatios.grey + currentRatios.yellow + currentRatios.white;
        const transitSpeed = (currentRatios.red * 2.0) + (currentRatios.orange * 1.5);
        
        const tempo = 70 + (transitSpeed * 80) + (urbanDensity * 40); 
        Tone.Transport.bpm.rampTo(tempo, 1);
        
        // CHIMES: Volume swells in residential/street areas
        chimePoly.volume.rampTo(-18 + (urbanDensity * 12), 0.5);

        // WATER: Reverb/Cloudiness
        masterReverb.wet.rampTo(0.1 + (currentRatios.blue * 0.7), 1.5);
        waterPad.volume.rampTo(-30 + (currentRatios.blue * 20), 1.5);

        // THE BASS: Explicitly loud and heavy when Green is detected
        natureBase.volume.rampTo(-25 + (currentRatios.green * 22), 1.2);
    }

    // 4. AUDIO INITIALIZATION
    startBtn.onclick = async () => {
        try {
            await Tone.start();

            // Limiter to keep the bass heavy without clipping
            const limiter = new Tone.Limiter(-2).toDestination();
            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.2 }).connect(limiter);

            // HIGH: Mellow FM Chimes (Urban Pop-out)
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 1.5, // Less "weird" more "natural"
                envelope: { attack: 0.1, decay: 0.3, sustain: 0.1, release: 1.2 }
            }).connect(masterReverb);

            // MID: Stretched Pad (Water/Medium)
            waterPad = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 3, sustain: 0.4, release: 8 }
            }).connect(masterReverb);

            // LOW: Heavy, Deep, Mushy Base (Nature)
            // Using a FatOscillator for a "thicker" sound
            const lowFilter = new Tone.Filter(70, "lowpass").connect(masterReverb);
            natureBase = new Tone.MonoSynth({
                oscillator: { type: "fatsine", count: 3, spread: 20 },
                envelope: { attack: 1.5, decay: 2, sustain: 0.8, release: 10 }
            }).connect(lowFilter);

            // GENERATIVE LOOP
            new Tone.Loop(time => {
                // URBAN POP-OUT: Houses and Streets trigger nodes more often
                const popProb = 0.1 + (currentRatios.grey * 0.5) + (currentRatios.yellow * 0.4);
                if (Math.random() < popProb) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time);
                }

                // FOUNDATION: Bass and Mid Pulse
                if (Tone.Transport.getTicksAtTime(time) % Tone.Ticks("2n").toNumber() === 0) {
                    // LONG DEEP BASS
                    if (Math.random() < (currentRatios.green + 0.4)) {
                        const bNote = SCALES.low[Math.floor(Math.random() * SCALES.low.length)];
                        natureBase.triggerAttackRelease(bNote, "1n", time);
                    }
                    // MEDIUM STRETCH
                    if (Math.random() < (currentRatios.blue + 0.4)) {
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
    marker.on('dragend', () => {
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