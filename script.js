const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

// EXPANDED CITIES
const CITIES = {
    PVD: [41.8245, -71.4128],
    BOS: [42.3601, -71.0589]
};

let map, marker, chimePoly, bassSynth, masterReverb, masterDelay, masterGain, townFilter;
let isAudioActive = false;
let blend = { urban: 0, nature: 0, ocean: 0 };

function init() {
    const startPos = [41.8245, -71.4128]; 
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function calculateGeography() {
        const pos = marker.getLatLng();
        
        // 1. URBAN CHECK (PVD + BOS)
        const distPVD = pos.distanceTo(CITIES.PVD);
        const distBOS = pos.distanceTo(CITIES.BOS);
        const minDist = Math.min(distPVD, distBOS);
        blend.urban = Math.max(0, 1 - (minDist / 3000));
        
        // 2. OCEAN (Providence River / Boston Harbor)
        const isCoastal = (pos.lng > -71.402 && pos.lat < 41.815) || // PVD
                          (pos.lng > -71.040 && pos.lat < 42.370);   // BOS
        blend.ocean = isCoastal ? 0.9 : 0;

        // 3. NATURE (Parks/Mountains)
        // Nature is high when you are far from cities and NOT in the water
        blend.nature = Math.max(0, 1 - blend.urban - (blend.ocean * 0.5));

        if (isAudioActive) updateAudioEngine();
    }

    function updateAudioEngine() {
        const size = parseInt(slider.value) / 2000;

        // SPEED: Faster in Boston/PVD, slower in Parks/Ocean
        const targetBPM = 65 + (blend.urban * 45) - (blend.ocean * 20) - (blend.nature * 10);
        Tone.Transport.bpm.rampTo(Math.max(48, targetBPM), 0.5);

        // TOWN SOFTNESS: Use a resonant filter instead of a crusher
        // When in town, the filter opens up (brightens) but stays smooth
        townFilter.frequency.rampTo(800 + (blend.urban * 3000), 0.5);
        townFilter.Q.value = 1 + (blend.urban * 4); // Resonance adds the "Road Hum"

        // DEEP BASS: Active in Ocean and Nature (Parks)
        // It provides a "hug" of low frequency for calm areas
        const bassLevel = (blend.ocean > 0.4 || blend.nature > 0.6) ? -18 : -80;
        bassSynth.volume.rampTo(bassLevel + (size * 10), 1);

        // NATURE BLOOM: Soft entry for park notes
        chimePoly.set({ 
            envelope: { 
                attack: 0.02 + (blend.nature * 0.4),
                release: 1.5 + (blend.nature * 4) + (size * 4) 
            } 
        });

        masterReverb.wet.rampTo(0.1 + (size * 0.6), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(0.8, 1.5);

            masterReverb = new Tone.Reverb({ decay: 12, wet: 0.2 }).connect(masterGain);
            masterDelay = new Tone.FeedbackDelay("8n.", 0.4).connect(masterReverb);
            
            // The "Town" Filter - Replaces the sharp bitcrusher
            townFilter = new Tone.Filter(2000, "lowpass").connect(masterDelay);

            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 2 }
            }).connect(townFilter);

            // THE DEEP BASE (Grounding Sub)
            bassSynth = new Tone.MonoSynth({
                oscillator: { type: "triangle" }, // Warmer than sine for parks
                envelope: { attack: 3, release: 5 }
            }).connect(masterGain);
            bassSynth.triggerAttack("C2");
            bassSynth.volume.value = -80;

            // ARPEGGIATOR
            new Tone.Loop(time => {
                let pool = Math.random() > 0.85 ? VARIATION_NOTES : BASE_NOTES;
                let note = pool[Math.floor(Math.random() * pool.length)];
                
                // Urban = 16th notes (Precision), Nature = 8th notes (Flow)
                let prob = 0.4 + (blend.urban * 0.5);
                if (Math.random() < prob) {
                    chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            calculateGeography();
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