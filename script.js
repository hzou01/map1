let map, marker, chimePoly, natureBase, waterTexture, bitCrusher;
let isAudioActive = false;
let ratios = { green: 0.3, gray: 0.5, blue: 0.2 }; 

const URBAN_SCALE = ["C4", "Eb4", "G4", "Bb4", "C5", "Eb5"]; // Back to musical mid-highs
const NATURE_SCALE = ["C2", "G2", "Bb2"]; // Deep, soothing anchors

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
        
        updateAudioParams();
    }

    function updateAudioParams() {
        if (!isAudioActive) return;

        // URBAN: BitCrush grit (subtle) and Tempo
        bitCrusher.bits.rampTo(1 + (7 * (1 - ratios.gray)), 0.5); 
        const tempo = 80 + (ratios.gray * 100); 
        Tone.Transport.bpm.rampTo(tempo, 1);

        // WATER: The "Cloudy" texture
        const waterCloud = -50 + (ratios.blue * 35);
        waterTexture.volume.rampTo(waterCloud, 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();

            // 1. URBAN LAYER: Clean FM Chimes with BitCrusher
            bitCrusher = new Tone.BitCrusher(8).toDestination();
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 2,
                modulationIndex: 10,
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 1.2 }
            }).connect(bitCrusher);

            // 2. NATURE LAYER: The "Soothing Medium Tonal Base"
            // Using a thick triangle wave for that "warm" earth feeling
            natureBase = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 1.5, decay: 2, sustain: 0.8, release: 4 }
            }).toDestination();

            // 3. WATER LAYER: The "Cloud" (Hiss/Wash)
            const waterFilter = new Tone.AutoFilter("1n").toDestination().start();
            waterTexture = new Tone.Noise("pink").connect(waterFilter);
            waterTexture.volume.value = -50;
            waterTexture.start();

            // GENERATIVE LOOP
            new Tone.Loop(time => {
                // Urban Chimes (Gray) - Back to the melodic style
                if (Math.random() < (0.1 + ratios.gray * 0.7)) {
                    const note = URBAN_SCALE[Math.floor(Math.random() * URBAN_SCALE.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time);
                }

                // Nature Base (Green) - Triggered every 4 beats for a slow "pulse"
                if (Tone.Transport.getTicksAtTime(time) % (Tone.Ticks("1n").toNumber()) === 0) {
                    if (Math.random() < (0.2 + ratios.green)) {
                        const note = NATURE_SCALE[Math.floor(Math.random() * NATURE_SCALE.length)];
                        natureBase.triggerAttackRelease(note, "1n", time);
                    }
                }
            }, "8n").start(0);

            Tone.Transport.start();
            startBtn.innerText = "PROBE ACTIVE";
            isAudioActive = true;
        } catch (err) { console.error(err); }
    };

    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);
    marker.on('dragend', () => {
        ratios.green = Math.random(); 
        ratios.gray = Math.random();
        ratios.blue = 1 - (ratios.green + ratios.gray);
        syncProbe();
    });
    setTimeout(syncProbe, 100);
}

window.onload = init;