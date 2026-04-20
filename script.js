const SCALES = {
    high: ["C4", "E4", "G4", "B4", "C5"],  // Urban: Bright/Maj7
    mid: ["G3", "A3", "C4", "D4", "E4"],   // Forest: Warm/Medium Shimmer
    low: ["C2", "G2", "C3", "E3"]          // Ocean: Deep/Liquid
};

const ZONES = {
    PVD: { center: [41.8245, -71.4128], radius: 2500 },
    BOS: { center: [42.3601, -71.0589], radius: 4000 },
    NYC: { center: [40.7128, -74.0060], radius: 6000 }
};

let map, marker, chimePoly, noiseSynth, waterFlow, masterReverb, masterGain;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, green: 0.1 };

function init() {
    const startPos = [41.8245, -71.4128];
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = radiusMeters + "m";

        const centerLatLng = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(centerLatLng);
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const fullPath = `M 0 0 H ${w} V ${h} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;

        // RADIUS RESPONSIVENESS
        // Size factor: 0.1 (small) to 1.0 (large)
        const sizeFactor = radiusMeters / 2000; 
        
        // 1. Geography Check
        let inUrban = false;
        for (let key in ZONES) {
            const zone = ZONES[key];
            if (centerLatLng.distanceTo(zone.center) < zone.radius) { inUrban = true; break; }
        }

        const isWater = (centerLatLng.lng > -71.405 && centerLatLng.lat < 41.818) || 
                        (centerLatLng.lng > -71.050 && centerLatLng.lat < 42.360);

        if (isWater) currentRatios = { urban: 0.1, blue: 0.9, green: 0.0 };
        else if (inUrban) currentRatios = { urban: 0.9, blue: 0.05, green: 0.05 };
        else currentRatios = { urban: 0.1, blue: 0.1, green: 0.8 };

        if (isAudioActive) updateAudioEngine(sizeFactor);
    }

    function updateAudioEngine(size) {
        const { urban, blue, green } = currentRatios;

        // RHYTHM: Forest stays medium/active. Ocean is pulsed.
        const baseBPM = 60 + (urban * 70) + (green * 15);
        const sizeSlowdown = size * 15; // Larger probe = more "drifting" feel
        Tone.Transport.bpm.rampTo(Math.max(50, baseBPM - sizeSlowdown), 0.5);

        // MELODY SHIFT
        chimePoly.set({ 
            harmonicity: green > 0.5 ? 3.8 : 1.5, // Shimmers in forest
            modulationIndex: 10 * urban + (5 * size), // Complexity increases with size
        });

        // WAVE VOLUME: Softer, more "lapping"
        const waveLevel = blue > 0.5 ? (-28 + (size * 5)) : -80;
        waterFlow.volume.rampTo(waveLevel, 1.0);

        // REVERB: More "space" as the probe grows
        masterReverb.wet.rampTo(0.1 + (size * 0.4), 1.0);

        // EFFECTS: Envelope release
        const rel = 0.5 + (blue * 8) + (green * 3) + (size * 4);
        chimePoly.set({ envelope: { release: rel } });
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(1, 1.5);

            masterReverb = new Tone.Reverb({ decay: 12, wet: 0.2 }).connect(masterGain);

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "sine" }, // Smoother, less aggressive
                envelope: { attack: 0.08, decay: 0.4, sustain: 0.5, release: 2 }
            }).connect(masterReverb);

            noiseSynth = new Tone.Noise("pink").connect(new Tone.Filter(800, "highpass").connect(masterGain));
            noiseSynth.volume.value = -80;
            noiseSynth.start();

            // SOFT WATER: Pink noise with a very slow LFO for wave movement
            const lfo = new Tone.LFO("0.1hz", 400, 1200).start();
            const waterFilter = new Tone.Filter(800, "lowpass").connect(masterReverb);
            lfo.connect(waterFilter.frequency);
            
            waterFlow = new Tone.Noise("pink").connect(waterFilter);
            waterFlow.start();
            waterFlow.volume.value = -80;

            new Tone.Loop(time => {
                const prob = 0.85; 
                if (Math.random() < prob) {
                    let scale = (currentRatios.blue > 0.6) ? SCALES.low : 
                                (currentRatios.green > 0.5) ? SCALES.mid : SCALES.high;

                    const note = scale[Math.floor(Math.random() * scale.length)];
                    chimePoly.triggerAttackRelease(note, "8n", time, 0.5);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            syncProbe();
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom drag', syncProbe);
    marker.on('drag', syncProbe);
}

window.onload = init;