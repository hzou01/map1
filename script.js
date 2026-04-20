const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"],
    mid: ["G2", "Bb2", "C3", "D3"],
    low: ["C2", "Eb2", "G2"] // Raised from C1 to C2 to stop the "stuck" bass
};

let map, marker, chimePoly, noiseSynth, masterReverb;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, green: 0.1 };

function init() {
    // START AT PROVIDENCE (RISD/BROWN AREA)
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

        // REFINED SENSING
        const distToProv = centerLatLng.distanceTo([41.824, -71.412]);
        const isWater = centerLatLng.lat < 41.815 || centerLatLng.lng > -71.395; // Focused on the Bay/River
        
        currentRatios.urban = (distToProv < 2500 || zoom > 15) ? 0.9 : 0.2;
        currentRatios.blue = isWater ? 0.9 : 0.1;
        currentRatios.green = (!isWater && distToProv > 2500) ? 0.8 : 0.1;

        if (isAudioActive) updateAudioEngine();
    }

    function updateAudioEngine() {
        const { urban, blue, green } = currentRatios;

        // 1. PREVENT "STUCK" RHYTHM: Set a hard floor for BPM
        const targetBPM = 45 + (urban * 95) - (blue * 15);
        Tone.Transport.bpm.rampTo(Math.max(40, targetBPM), 0.5);

        // 2. LIQUID TONE: Boost Ocean Gain
        // We increase volume in the ocean so nodes don't vanish
        const nodeVol = -5 + (blue * 5); 
        chimePoly.volume.rampTo(nodeVol, 0.3);

        // 3. KILL THE DEEP BASS: High-pass the synth based on environment
        // Forest (Green) = 200Hz cutoff (Clean). City (Urban) = 100Hz (Deep).
        const filterFreq = 100 + (green * 300);
        chimePoly.set({ 
            modulationIndex: 12 * urban + 3 * green,
            harmonicity: 1.5 + (urban * 2) 
        });

        // 4. INDUSTRIAL NOISE: Quiet background
        const noiseVol = -65 + (urban * 30);
        noiseSynth.volume.rampTo(Math.min(-25, noiseVol), 0.4);

        // 5. OCEAN STRETCH
        const release = 0.4 + (blue * 12) + (green * 2);
        chimePoly.set({ envelope: { release: release } });
        masterReverb.wet.rampTo(0.1 + (blue * 0.6), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            // Shorter decay to prevent low-frequency "mud" buildup
            masterReverb = new Tone.Reverb({ decay: 8, wet: 0.2 }).toDestination();

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                modulationIndex: 10,
                harmonicity: 3,
                oscillator: { type: "fatsine2" }, // Richer than sine, thinner than square
                envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 1 }
            }).connect(masterReverb);

            // High-pass filter on the noise to stop the "Deep Bass" crash
            const noiseFilter = new Tone.Filter(350, "highpass").toDestination();
            noiseSynth = new Tone.Noise("brown").connect(noiseFilter);
            noiseSynth.start();

            new Tone.Loop(time => {
                // Ocean nodes trigger more often to ensure they are heard
                const prob = 0.3 + (currentRatios.urban * 0.6) + (currentRatios.blue * 0.4);
                
                if (Math.random() < Math.min(0.9, prob)) {
                    let scale = SCALES.high;
                    if (currentRatios.blue > 0.6) scale = SCALES.low;
                    else if (currentRatios.green > 0.5) scale = SCALES.mid;

                    const note = scale[Math.floor(Math.random() * scale.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time, 0.8);
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
    map.whenReady(() => setTimeout(syncProbe, 150));
}

window.onload = init;