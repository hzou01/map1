// A single, unified "Natural" scale that works across all layers
const ROOT = "C2";
const SCALES = {
    URBAN:  ["C4", "E4", "G4", "B4", "D5"], // Bright, Sophisticated
    FOREST: ["G3", "A3", "C4", "D4", "E4"], // Warm, Grounded
    OCEAN:  ["C2", "E2", "G2", "B2"]        // Deep, Liquid
};

let map, marker, chimePoly, noiseSynth, waterFlow, masterReverb, masterGain, bassSynth;
let isAudioActive = false;
let blend = { urban: 0, forest: 0, ocean: 0 };

function init() {
    const startPos = [41.8245, -71.4128];
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
        
        // Urban Fade (Providence Center)
        const pvdDist = pos.distanceTo([41.8245, -71.4128]);
        blend.urban = Math.max(0, 1 - (pvdDist / 3500));

        // Ocean/River (Providence River / Coastal)
        const isCoastal = (pos.lng > -71.402 && pos.lat < 41.815);
        blend.ocean = isCoastal ? 0.8 : 0.0;

        // Forest (Default state)
        blend.forest = Math.max(0.3, 1 - blend.urban - blend.ocean);

        if (isAudioActive) updateAudioEngine(radiusMeters / 2000);
    }

    function updateAudioEngine(size) {
        // Slowing down the rhythm for the Ocean, keeping Forest active
        const baseBPM = 65 + (blend.urban * 45) - (blend.ocean * 20);
        Tone.Transport.bpm.rampTo(Math.max(55, baseBPM), 0.5);

        // Soften the industrial noise to be a "hum" rather than a "scratch"
        noiseSynth.volume.rampTo(-50 + (blend.urban * 10), 0.5);
        
        // Liquid movement
        waterFlow.volume.rampTo(blend.ocean > 0.1 ? -30 : -80, 1.2);

        // Size affects Reverb and Bass depth
        masterReverb.wet.rampTo(0.1 + (size * 0.4), 1.0);
        bassSynth.volume.rampTo(-25 + (size * 10), 0.5);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(1, 2); // Slow, natural fade-in

            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.2 }).connect(masterGain);

            // THE MELODY (FMSynth for glass-like texture)
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.2, decay: 0.8, sustain: 0.4, release: 4 }
            }).connect(masterReverb);

            // THE BASS (Grounding Tone)
            bassSynth = new Tone.MonoSynth({
                oscillator: { type: "sine" },
                envelope: { attack: 1, release: 4 }
            }).connect(masterGain);
            bassSynth.triggerAttack(ROOT);
            bassSynth.volume.value = -25;

            // Layer: Road Hum
            noiseSynth = new Tone.Noise("pink").connect(new Tone.Filter(1500, "highpass").connect(masterGain));
            noiseSynth.start();

            // Layer: Ocean Pulse
            const lfo = new Tone.LFO("0.05hz", 600, 1200).start();
            const waterFilter = new Tone.Filter(700, "lowpass").connect(masterReverb);
            lfo.connect(waterFilter.frequency);
            waterFlow = new Tone.Noise("pink").connect(waterFilter);
            waterFlow.start();

            // THE LOOP
            new Tone.Loop(time => {
                let scale;
                const r = Math.random();
                
                // Probabilistic Selection
                if (r < blend.urban) scale = SCALES.URBAN;
                else if (r < blend.urban + blend.forest) scale = SCALES.FOREST;
                else scale = SCALES.OCEAN;

                const note = scale[Math.floor(Math.random() * scale.length)];
                
                // Softer volume (velocity) for a natural feel
                const vel = 0.2 + (blend.urban * 0.3);
                chimePoly.triggerAttackRelease(note, "2n", time, vel);
            }, "4n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            calculateLayers();
            startBtn.innerText = "PROBE ACTIVE";
        } catch (e) { console.error(e); }
    };

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