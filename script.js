const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"], // City: Sharp/Industrial
    mid: ["G3", "Bb3", "C4", "D4"],         // Forest: Warm/Vibrant
    low: ["C2", "Eb2", "G2", "Bb2"]         // Ocean: Deep but audible
};

let map, marker, chimePoly, noiseSynth, masterReverb;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, green: 0.1 };

function init() {
    // START AT PROVIDENCE (RISD/BROWN)
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        const centerLatLng = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(centerLatLng);
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const fullPath = `M 0 0 H ${w} V ${h} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;

        // SENSING LOGIC
        const distToProv = centerLatLng.distanceTo([41.824, -71.412]);
        const isWater = centerLatLng.lat < 41.815 || centerLatLng.lng > -71.395;
        
        currentRatios.urban = (distToProv < 2500 || zoom > 15) ? 0.9 : 0.1;
        currentRatios.blue = isWater ? 0.9 : 0.1;
        currentRatios.green = (!isWater && distToProv > 2500) ? 0.8 : 0.1;

        if (isAudioActive) updateAudioEngine();
    }

    function updateAudioEngine() {
        const { urban, blue, green } = currentRatios;

        // 1. VIBRANT RHYTHM: Slow but never "stuck"
        // Ocean (blue) slows it down, but we keep a healthy floor of 48 BPM
        const targetBPM = 48 + (urban * 92) - (blue * 10);
        Tone.Transport.bpm.rampTo(Math.max(45, targetBPM), 0.5);

        // 2. TONE: Vibrant vs Depressing
        // Harmonicity at 2.5 gives a "musical" shimmer to the bass
        chimePoly.set({ 
            modulationIndex: 15 * urban + 4 * blue + 2 * green,
            harmonicity: 2.5 + (blue * 0.5) 
        });

        // 3. CLEANER BASS: Avoid the "Stuck" feeling
        // We move the volume UP in the ocean to keep it vibrant
        const nodeVol = -8 + (blue * 6); 
        chimePoly.volume.rampTo(nodeVol, 0.3);

        // 4. INDUSTRIAL TEXTURE: High-pass to remove "mud"
        const noiseVol = -70 + (urban * 35);
        noiseSynth.volume.rampTo(noiseVol, 0.4);

        // 5. LONG REVERB: Symphonic but clear
        const release = 0.5 + (blue * 12) + (green * 3);
        chimePoly.set({ envelope: { release: release } });
        masterReverb.wet.rampTo(0.1 + (blue * 0.5), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            // Decay is 10s for that "long" feeling without the mud
            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.2 }).toDestination();

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                modulationIndex: 10,
                harmonicity: 2.5,
                oscillator: { type: "fatsine2" }, 
                envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 2 }
            }).connect(masterReverb);

            // Clean the "Noise" pipe so it never overpowers the nodes
            const noiseFilter = new Tone.Filter(400, "highpass").toDestination();
            noiseSynth = new Tone.Noise("brown").connect(noiseFilter);
            noiseSynth.start();

            new Tone.Loop(time => {
                const prob = 0.4 + (currentRatios.urban * 0.5);
                if (Math.random() < prob) {
                    let scale = SCALES.high;
                    if (currentRatios.blue > 0.6) scale = SCALES.low;
                    else if (currentRatios.green > 0.5) scale = SCALES.mid;

                    const note = scale[Math.floor(Math.random() * scale.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time, 0.7);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            startBtn.innerText = "SYSTEM ONLINE";
            updateAudioEngine();
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
    map.whenReady(() => setTimeout(syncProbe, 200));
}

window.onload = init;