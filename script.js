let map, marker, chimePoly, natureBase, waterTexture, bitCrusher, drone;
let isAudioActive = false;
let ratios = { green: 0.3, gray: 0.5, blue: 0.2 }; 

const URBAN_SCALE = ["C5", "D5", "Eb5", "G5", "Ab5", "C6", "D6"]; 
const NATURE_SCALE = ["C2", "Eb2", "G2"]; // Deep, soothing bass

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

        // URBAN: BitCrush intensity and Tempo
        bitCrusher.bits.rampTo(1 + (7 * (1 - ratios.gray)), 0.5); 
        const tempo = Math.max(50, 100 + (ratios.gray * 120)); // NYC speeds (up to 220bpm)
        Tone.Transport.bpm.rampTo(tempo, 1);

        // NATURE: Bass Volume & Depth
        natureBase.volume.rampTo(-40 + (ratios.green * 30), 1);

        // WATER: Cloudiness (Filter + Noise)
        const waterCloud = -50 + (ratios.blue * 40);
        waterTexture.volume.rampTo(waterCloud, 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();

            // 1. URBAN LAYER: High Jitter + Grit
            bitCrusher = new Tone.BitCrusher(8).toDestination();
            chimePoly = new Tone.PolySynth(Tone.FMSynth).connect(bitCrusher);
            chimePoly.set({ 
                harmonicity: 3.5, 
                envelope: { attack: 0.001, release: 0.1 } 
            });

            // 2. NATURE LAYER: The Low Soothe (Deep Sine Base)
            natureBase = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 2, decay: 2, sustain: 1, release: 5 }
            }).toDestination();
            natureBase.volume.value = -40;

            // 3. WATER LAYER: The Cloud (Noise + AutoFilter for texture)
            const waterFilter = new Tone.AutoFilter("1n").toDestination().start();
            waterTexture = new Tone.Noise("white").connect(waterFilter);
            waterTexture.volume.value = -50;
            waterTexture.start();

            // THE GENERATIVE SCORE
            new Tone.Loop(time => {
                // High-Speed Urban Scatter (16th notes)
                if (Math.random() < (0.05 + ratios.gray * 0.9)) {
                    const note = URBAN_SCALE[Math.floor(Math.random() * URBAN_SCALE.length)];
                    chimePoly.triggerAttackRelease(note, "64n", time);
                }

                // Nature "Breathe" (Only every 2 measures)
                if (Tone.Transport.getTicksAtTime(time) % (Tone.Ticks("1n").toNumber() * 2) === 0) {
                    if (Math.random() < ratios.green) {
                        const note = NATURE_SCALE[Math.floor(Math.random() * NATURE_SCALE.length)];
                        natureBase.triggerAttackRelease(note, "1n", time);
                    }
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
        ratios.green = Math.random(); 
        ratios.gray = Math.random();
        ratios.blue = 1 - (ratios.green + ratios.gray);
        syncProbe();
    });
    setTimeout(syncProbe, 100);
}

window.onload = init;