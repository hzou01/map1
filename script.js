// Your core palette + a few 'safe' anchor notes for variation
const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

let map, marker, chimePoly, bassSynth, masterReverb, masterDelay, masterGain, industrialCrush;
let isAudioActive = false;
let blend = { urban: 0, nature: 0, ocean: 0 };

function init() {
    const startPos = [41.8245, -71.4128]; // Kennedy Plaza, PVD
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function calculateGeography() {
        const pos = marker.getLatLng();
        const pvdDist = pos.distanceTo([41.8245, -71.4128]);
        
        // 1. URBAN (Roads/Density)
        blend.urban = Math.max(0, 1 - (pvdDist / 2500));
        
        // 2. OCEAN (Slow/Deep)
        const isCoastal = (pos.lng > -71.402 && pos.lat < 41.815);
        blend.ocean = isCoastal ? 0.9 : 0;

        // 3. NATURE (Soft/Misty)
        // If not urban or ocean, it's "Nature"
        blend.nature = Math.max(0.1, 1 - blend.urban - blend.ocean);

        if (isAudioActive) updateAudioEngine();
    }

    function updateAudioEngine() {
        const size = parseInt(slider.value) / 2000;

        // SPEED LOGIC: Faster on roads, dragging in oceans
        const targetBPM = 70 + (blend.urban * 50) - (blend.ocean * 30);
        Tone.Transport.bpm.rampTo(Math.max(45, targetBPM), 0.5);

        // SOFTNESS (Nature): Long attack makes notes "bloom"
        const softAttack = 0.02 + (blend.nature * 0.3);
        chimePoly.set({ 
            envelope: { 
                attack: softAttack,
                release: 1 + (blend.nature * 3) + (size * 3) 
            } 
        });

        // INDUSTRIAL NOISE: Stronger resonance & Bitcrush on roads
        industrialCrush.wet.value = blend.urban * 0.4;
        
        // OCEAN PULSE: Deep sub-bass comes in
        bassSynth.volume.rampTo(blend.ocean > 0.5 ? -20 : -80, 1);

        // SPACE: Reverb wetness follows size
        masterReverb.wet.rampTo(0.1 + (size * 0.5), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(0.8, 1.5);

            // EFFECTS CHAIN
            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.2 }).connect(masterGain);
            masterDelay = new Tone.FeedbackDelay("8n.", 0.4).connect(masterReverb);
            industrialCrush = new Tone.BitCrusher(4).connect(masterDelay); // The "Road" texture
            industrialCrush.wet.value = 0;

            // THE PROBE (Crystalline Sine)
            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 2 }
            }).connect(industrialCrush);

            // THE OCEAN ROOT (Sub Bass)
            bassSynth = new Tone.MonoSynth({
                oscillator: { type: "sine" },
                envelope: { attack: 2, release: 4 }
            }).connect(masterGain);
            bassSynth.triggerAttack("C2");
            bassSynth.volume.value = -80;

            // THE ARPEGGIATOR: Freedom within your C5-G4-E5-B4 notes
            new Tone.Loop(time => {
                // High probability for core notes, low for variations
                let pool = Math.random() > 0.8 ? VARIATION_NOTES : BASE_NOTES;
                let note = pool[Math.floor(Math.random() * pool.length)];
                
                // Urban areas trigger 16th notes (faster), Nature triggers 8th notes
                let prob = 0.5 + (blend.urban * 0.4);
                if (Math.random() < prob) {
                    chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            calculateGeography();
            startBtn.innerText = "PROBE ONLINE";
        } catch (e) { console.error(e); }
    };

    const sync = () => {
        const radiusMeters = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = radiusMeters + "m";
        const centerPoint = map.latLngToContainerPoint(marker.getLatLng());
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;

        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        calculateGeography();
    };

    slider.oninput = sync;
    marker.on('drag', sync);
    map.on('zoom move', sync);
}

window.onload = init;