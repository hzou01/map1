const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"], // City: Sharp/Industrial
    mid: ["G3", "A3", "C4", "D4", "E4"],    // Forest: Bright/Warm (Major-ish)
    low: ["C2", "G2", "C3", "Eb3"]          // Ocean: Deep/Liquid
};

let map, marker, chimePoly, noiseSynth, waterFlow, masterReverb;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, green: 0.1 };

function init() {
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

        // 1. RHYTHM: Moderate slowdown, but stays active
        const targetBPM = 55 + (urban * 85) - (blue * 15);
        Tone.Transport.bpm.rampTo(Math.max(50, targetBPM), 0.5);

        // 2. FOREST BRIGHTNESS (Green)
        // High harmonicity makes the forest "shimmer" in the mid-tones
        if (green > 0.5) {
            chimePoly.set({ modulationIndex: 3, harmonicity: 3.5 });
        } else if (blue > 0.5) {
            chimePoly.set({ modulationIndex: 8, harmonicity: 1.5 });
        } else {
            chimePoly.set({ modulationIndex: 15, harmonicity: 2.0 });
        }

        // 3. WATER SOUND (Blue)
        // Pink noise with an auto-filter creates the "rushing water" feel
        waterFlow.volume.rampTo(blue > 0.5 ? -25 : -60, 1.0);

        // 4. NODES: Fixed the "one node" issue with higher probability
        const nodeVol = -6 + (blue * 4); 
        chimePoly.volume.rampTo(nodeVol, 0.3);

        // 5. INDUSTRIAL DUCKING
        noiseSynth.volume.rampTo(-75 + (urban * 40), 0.4);

        const release = 0.5 + (blue * 10) + (green * 2);
        chimePoly.set({ envelope: { release: release } });
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterReverb = new Tone.Reverb({ decay: 8, wet: 0.25 }).toDestination();

            // NODES
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "fatsine2" }, 
                envelope: { attack: 0.04, decay: 0.2, sustain: 0.4, release: 2 }
            }).connect(masterReverb);

            // INDUSTRIAL NOISE
            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(500, "highpass").toDestination());
            noiseSynth.start();

            // WATER TEXTURE (The Ocean Sound)
            const waterFilter = new Tone.AutoFilter("0.1n", 800, 2).connect(masterReverb).start();
            waterFlow = new Tone.Noise("pink").connect(waterFilter);
            waterFlow.start();
            waterFlow.volume.value = -60;

            new Tone.Loop(time => {
                // Guaranteed node activity (70% probability floor)
                const prob = 0.7; 
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
            startBtn.innerText = "PROBE ACTIVE";
            updateAudioEngine();
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
    map.whenReady(() => setTimeout(syncProbe, 200));
}

window.onload = init;