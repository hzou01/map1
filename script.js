const MAP_THEME = {
    HIGHWAY_RED:   "#DC96A2", 
    ROAD_ORANGE:   "#F6D8A9", 
    STREET_YELLOW: "#F8FAC4", 
    STREET_WHITE:  "#FFFFFF",
    HOUSE_GREY:    "#D8D1C9", 
    PARK_GREEN:    "#B4D0A2", 
    WATER_BLUE:    "#B2D2DE"
};

const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"],
    mid: ["G2", "Bb2", "C3", "D3"],
    low: ["C1", "Eb1", "G1"]
};

let map, marker, chimePoly, noiseSynth, masterReverb, waterFlow;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, green: 0.1 };

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([42.345, -71.07], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    marker = L.marker([42.345, -71.07], { draggable: true }).addTo(map);

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

        // ENVIRONMENTAL SENSING LOGIC
        const distToProv = centerLatLng.distanceTo([41.824, -71.412]);
        const distToBoston = centerLatLng.distanceTo([42.358, -71.057]);
        const isUrban = distToProv < 3000 || distToBoston < 4000 || zoom > 15;
        
        // Check for Water (Simplified check for Charles River/Providence River/Bay)
        const isWater = centerLatLng.lng > -71.04 || (centerLatLng.lat < 41.81 && centerLatLng.lng > -71.40);

        currentRatios.urban = isUrban ? 0.9 : 0.2;
        currentRatios.blue = isWater ? 0.8 : 0.1;
        currentRatios.green = (!isUrban && !isWater) ? 0.7 : 0.1;

        if (isAudioActive) updateAudioEngine();
    }

    function updateAudioEngine() {
        const { urban, blue, green } = currentRatios;

        // 1. TEMPORAL DRAG: Rivers and Oceans slow down the rhythm
        const targetBPM = 35 + (urban * 105) - (blue * 20);
        Tone.Transport.bpm.rampTo(Math.max(22, targetBPM), 0.5);

        // 2. THE LIQUID TONE: FM Modulation Index
        // Urban = High index (Metallic/Glass). Green = Low index (Soft/Pure).
        const modIndex = 12 * urban + 2 * green; 
        chimePoly.set({ 
            modulationIndex: modIndex,
            harmonicity: 1.5 + (urban * 2) 
        });

        // 3. INDUSTRIAL RESONANCE: Road noise increases near urban density
        const noiseVol = -65 + (urban * 38);
        const noiseCutoff = 200 + (urban * 600);
        noiseSynth.volume.rampTo(noiseVol, 0.4);
        noiseSynth.filter.frequency.rampTo(noiseCutoff, 0.4);

        // 4. SYMPHONIC PROLONGING: Extension in water
        const release = 0.3 + (blue * 14.7) + (green * 3);
        chimePoly.set({ envelope: { release: release } });
        
        masterReverb.wet.rampTo(0.1 + (blue * 0.7), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterReverb = new Tone.Reverb({ decay: 12, wet: 0.2 }).toDestination();

            // THE FM SYNTH: Optimized for that "Liquid Glass" tone
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                modulationIndex: 10,
                harmonicity: 3,
                oscillator: { type: "sine" },
                modulation: { type: "square" },
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 1 }
            }).connect(masterReverb);

            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(300, "lowpass").toDestination());
            noiseSynth.start();

            // DYNAMIC LOOP: Scales and probability change with the map
            new Tone.Loop(time => {
                const prob = 0.2 + (currentRatios.urban * 0.7);
                if (Math.random() < prob) {
                    let scale = SCALES.high;
                    if (currentRatios.blue > 0.6) scale = SCALES.low;
                    else if (currentRatios.green > 0.5) scale = SCALES.mid;

                    const note = scale[Math.floor(Math.random() * scale.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time, 0.7);
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

    map.whenReady(() => setTimeout(syncProbe, 100));
}

window.onload = init;