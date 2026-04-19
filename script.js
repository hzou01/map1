let map, marker, droneSynth, noiseSynth, chimePoly, melodyLoop;
let isAudioActive = false;

// The "TopToChop" data remains the driver
let ratios = { green: 0.3, gray: 0.5, blue: 0.2 }; 
// Moving the scale up to Octave 4 and 5 for that "chiming" feel
const SCALE = ["C4", "Eb4", "F4", "G4", "Bb4", "C5", "Eb5", "G5"];

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        const markerLatLng = marker.getLatLng();
        display.innerText = radiusMeters >= 1000 ? (radiusMeters/1000).toFixed(1) + "km" : radiusMeters + "m";

        const centerPoint = map.latLngToContainerPoint(markerLatLng);
        const metersPerPixel = 156543.03392 * Math.cos(markerLatLng.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = radiusMeters / metersPerPixel;

        const holeX = centerPoint.x + 100; 
        const holeY = centerPoint.y + 100;
        const fullPath = `M 0 0 H ${window.innerWidth + 200} V ${window.innerHeight + 200} H 0 Z M ${holeX} ${holeY} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;

        frost.style.webkitClipPath = `path('${fullPath}')`;
        frost.style.clipPath = `path('${fullPath}')`;
        
        updateAudioParams();
    }

    function updateAudioParams() {
        if (!isAudioActive) return;
        
        // GREEN -> Softens the chime (Lowpass Filter)
        const cutoff = 1000 + (ratios.green * 4000);
        chimePoly.set({ envelope: { release: 0.5 + ratios.green } });

        // GRAY -> Increases "Chime Density" (Melody complexity)
        // No more heavy noise—just more frequent high notes.

        // BLUE -> Slows the pace, but keeps it light
        Tone.Transport.bpm.rampTo(80 + (ratios.blue * 40), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();

            // 1. THE CHIME (FMSynth is perfect for bell/glass sounds)
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 3,
                modulationIndex: 10,
                oscillator: { type: "sine" },
                envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 1.2 },
                modulation: { type: "square" }
            }).toDestination();

            // 2. THE SHIMMER (Replacing the heavy base)
            droneSynth = new Tone.Oscillator("C4", "sine").toDestination();
            droneSynth.volume.value = -25; // Very subtle
            droneSynth.start();

            // 3. GENERATIVE SEQUENCE
            melodyLoop = new Tone.Loop(time => {
                // Urban density (Gray) makes the melody more frantic/chiming
                if (Math.random() < (0.2 + ratios.gray * 0.6)) {
                    const note = SCALE[Math.floor(Math.random() * SCALE.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time);
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
        // Randomize ratios to simulate movement through different zones
        ratios.green = Math.random(); 
        ratios.gray = Math.random();
        ratios.blue = 1 - (ratios.green + ratios.gray);
        syncProbe();
    });

    setTimeout(syncProbe, 100);
}

window.onload = init;