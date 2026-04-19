let map, marker, chimePoly, natureSynth, bitCrusher, drone;
let isAudioActive = false;
let ratios = { green: 0.3, gray: 0.5, blue: 0.2 }; 

// Two scales for the two melodies
const URBAN_SCALE = ["C5", "D5", "Eb5", "G5", "Ab5", "C6"]; // Sharp, high
const NATURE_SCALE = ["C3", "Eb3", "G3", "Bb3"]; // Low, soft

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

        // Visual hole logic (Same as before)
        const holeX = centerPoint.x + 100; 
        const holeY = centerPoint.y + 100;
        const fullPath = `M 0 0 H ${window.innerWidth + 200} V ${window.innerHeight + 200} H 0 Z M ${holeX} ${holeY} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;
        
        updateAudioParams();
    }

    function updateAudioParams() {
        if (!isAudioActive) return;

        // 1. ROAD EFFECT: Resonance & Grit (Gray)
        // High roads = high distortion and more "broken" sound
        bitCrusher.bits.rampTo(1 + (8 * (1 - ratios.gray)), 0.5); 
        
        // 2. WATER EFFECT: Speed (Blue)
        // More water = significantly slower rhythm
        const tempo = Math.max(40, 180 - (ratios.blue * 140));
        Tone.Transport.bpm.rampTo(tempo, 1);

        // 3. PARK EFFECT: Softness (Green)
        // More parks = longer release and lower filter (muffled/dreamy)
        const cutoff = 500 + (ratios.green * 4000);
        natureSynth.set({ envelope: { release: 1 + ratios.green * 4 } });
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();

            // EFFECT CHAIN: BitCrusher for the industrial road "noise"
            bitCrusher = new Tone.BitCrusher(8).toDestination();

            // MELODY 1: The Urban Jitter (High, sharp bells)
            chimePoly = new Tone.PolySynth(Tone.FMSynth).connect(bitCrusher);
            chimePoly.set({ envelope: { attack: 0.01, release: 0.2 } });

            // MELODY 2: The Nature Bloom (Soft, deep chords)
            natureSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.5, sustain: 0.3 }
            }).toDestination();

            // BACKGROUND DRONE: A constant shimmer
            drone = new Tone.Oscillator("C4", "sine").toDestination();
            drone.volume.value = -30;
            drone.start();

            // THE SEQUENCER (The Logic)
            new Tone.Loop(time => {
                // URBAN LAYER (Gray/Roads): Very fast, density increases with gray
                if (Math.random() < (0.1 + ratios.gray * 0.8)) {
                    const note = URBAN_SCALE[Math.floor(Math.random() * URBAN_SCALE.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time);
                }

                // NATURE LAYER (Green): Slower, only plays if green ratio is high
                if (Math.random() < (ratios.green * 0.5)) {
                    const note = NATURE_SCALE[Math.floor(Math.random() * NATURE_SCALE.length)];
                    natureSynth.triggerAttackRelease(note, "2n", time);
                }
            }, "16n").start(0);

            Tone.Transport.start();
            startBtn.innerText = "PROBE ACTIVE";
            isAudioActive = true;
        } catch (err) { console.error(err); }
    };

    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);
    marker.on('dragend', () => {
        // Drastic random shifts to test the effect
        ratios.green = Math.random(); 
        ratios.gray = Math.random();
        ratios.blue = 1 - (ratios.green + ratios.gray);
        syncProbe();
    });
    setTimeout(syncProbe, 100);
}

window.onload = init;