const SCALES = {
    URBAN: ["C4", "E4", "G4", "B4", "C5"],  // Strong resonance / Maj7
    FOREST: ["A3", "C4", "D4", "E4", "G4"], // Soft tones / Pentatonic
    OCEAN: ["C2", "G2", "C3", "E3"]         // Deep/Slow pulse
};

let map, marker, chimePoly, noiseSynth, waterFlow, masterReverb, masterGain;
let isAudioActive = false;

// We now track all three as a continuous blend
let blend = { urban: 0, forest: 0, ocean: 0 };

function init() {
    const startPos = [41.8245, -71.4128]; // Kennedy Plaza
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function calculateLayers() {
        const radiusMeters = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = radiusMeters + "m";
        const pos = marker.getLatLng();
        
        // 1. DISTANCE TO URBAN CORES (Stronger Resonance)
        const pvdDist = pos.distanceTo([41.8245, -71.4128]);
        const bosDist = pos.distanceTo([42.3601, -71.0589]);
        const nycDist = pos.distanceTo([40.7128, -74.0060]);
        const minDist = Math.min(pvdDist, bosDist, nycDist);
        
        // Urban is 1.0 at center, fades to 0.0 at 5km
        blend.urban = Math.max(0, 1 - (minDist / 5000));

        // 2. OCEAN/RIVER (Slower Rhythm)
        // Strictly coastal check to prevent "Suburban Ocean"
        const isCoastal = (pos.lng > -71.402 && pos.lat < 41.815) || // PVD River
                          (pos.lng > -71.045 && pos.lat < 42.365) || // BOS Harbor
                          (pos.lng > -74.025 && pos.lng < -73.97);   // NYC Rivers
        blend.ocean = isCoastal ? 0.9 : 0.0;

        // 3. FOREST/MOUNTAIN (Softer Tones)
        // Forest is the "base" layer that fills in where urban/ocean are weak
        blend.forest = Math.max(0.2, 1 - blend.urban - blend.ocean);

        if (isAudioActive) updateAudioEngine(radiusMeters / 2000);
    }

    function updateAudioEngine(size) {
        // RHYTHM: Roads = Fast, Ocean = Slow
        const baseBPM = 60 + (blend.urban * 60) - (blend.ocean * 25);
        Tone.Transport.bpm.rampTo(Math.max(40, baseBPM), 0.5);

        // INDUSTRIAL RESONANCE (High-pass Noise)
        noiseSynth.volume.rampTo(-45 + (blend.urban * 15), 0.5);
        
        // WAVE PULSE (Pink Noise)
        waterFlow.volume.rampTo(blend.ocean > 0.1 ? -28 : -80, 1.2);

        // REVERB & SPACE
        masterReverb.wet.rampTo(0.1 + (blend.forest * 0.3) + (size * 0.3), 1.0);

        // TONE CHARACTER
        chimePoly.set({
            harmonicity: 1.5 + (blend.forest * 2), // Shimmering forest
            modulationIndex: 5 + (blend.urban * 10) // Aggressive urban
        });
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(1, 1.5);

            masterReverb = new Tone.Reverb({ decay: 12, wet: 0.2 }).connect(masterGain);

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "fatsine" },
                envelope: { attack: 0.1, decay: 0.5, sustain: 0.4, release: 4 }
            }).connect(masterReverb);

            // Layer 1: Road Resonance
            noiseSynth = new Tone.Noise("pink").connect(new Tone.Filter(1200, "highpass").connect(masterGain));
            noiseSynth.start();

            // Layer 2: Ocean Lapping
            const lfo = new Tone.LFO("0.08hz", 500, 1500).start();
            const waterFilter = new Tone.Filter(800, "lowpass").connect(masterReverb);
            lfo.connect(waterFilter.frequency);
            waterFlow = new Tone.Noise("pink").connect(waterFilter);
            waterFlow.start();

            // Layer 3: The Melodic Weaver
            new Tone.Loop(time => {
                // We decide which "voice" speaks based on the blend
                let scale;
                const r = Math.random();
                if (r < blend.urban) scale = SCALES.URBAN;
                else if (r < blend.urban + blend.forest) scale = SCALES.FOREST;
                else scale = SCALES.OCEAN;

                const note = scale[Math.floor(Math.random() * scale.length)];
                
                // Velocity reflects the intensity of the layer
                const vel = 0.3 + (blend.urban * 0.4) + (blend.forest * 0.2);
                chimePoly.triggerAttackRelease(note, "4n", time, vel);
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            calculateLayers();
        } catch (e) { console.error(e); }
    };

    // UI Sync
    const update = () => {
        const radiusMeters = parseInt(slider.value);
        const centerLatLng = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(centerLatLng);
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;

        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        calculateLayers();
    };

    slider.oninput = update;
    marker.on('drag', update);
    map.on('zoom move', update);
}

window.onload = init;