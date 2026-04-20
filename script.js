const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"], 
    mid: ["G3", "A3", "C4", "D4", "E4"],   
    low: ["C2", "G2", "C3", "Eb3"]         
};

let map, marker, chimePoly, noiseSynth, waterFlow, masterReverb;
let isAudioActive = false;
// Start in a 'neutral' state
let currentRatios = { urban: 0.3, blue: 0.1, green: 0.1 };

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
        
        // Calculate the hole in the screen
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const fullPath = `M 0 0 H ${w} V ${h} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;

        // --- THE "INSTANT" DETECTION LOGIC ---
        // This calculates the state EVERY time the mouse moves
        const lat = centerLatLng.lat;
        const lng = centerLatLng.lng;

        // 1. IS IT WATER? (Providence River / Narragansett Bay / Charles River)
        const inWater = (lng > -71.402 && lat < 41.818) || (lng > -71.05 && lat < 42.36);
        
        // 2. IS IT URBAN? (Near downtown Providence or Boston)
        const nearPVD = centerLatLng.distanceTo([41.824, -71.412]) < 1500;
        const nearBOS = centerLatLng.distanceTo([42.358, -71.057]) < 2000;
        const isUrban = (nearPVD || nearBOS) && zoom > 14;

        // 3. SET RATIOS INSTANTLY
        if (inWater) {
            currentRatios = { urban: 0.1, blue: 0.9, green: 0.0 };
            console.log("STATE: OCEAN/RIVER");
        } else if (isUrban) {
            currentRatios = { urban: 0.9, blue: 0.1, green: 0.0 };
            console.log("STATE: URBAN/INDUSTRIAL");
        } else {
            currentRatios = { urban: 0.2, blue: 0.1, green: 0.7 };
            console.log("STATE: FOREST/PARK");
        }

        if (isAudioActive) updateAudioEngine();
    }

    function updateAudioEngine() {
        const { urban, blue, green } = currentRatios;

        // Rhythm Shift
        const targetBPM = 50 + (urban * 90) - (blue * 15);
        Tone.Transport.bpm.rampTo(targetBPM, 0.1); // Fast 0.1s ramp for instant feel

        // FM Tone Shift
        chimePoly.set({ 
            modulationIndex: 12 * urban + 4 * blue + 3 * green,
            harmonicity: green > 0.5 ? 3.5 : (blue > 0.5 ? 1.2 : 2.5) 
        });

        // Water/Industrial Volume Crossfade
        waterFlow.volume.rampTo(blue > 0.6 ? -20 : -60, 0.2);
        noiseSynth.volume.rampTo(urban > 0.6 ? -35 : -70, 0.2);

        // Env Release
        const rel = 0.4 + (blue * 10) + (green * 3);
        chimePoly.set({ envelope: { release: rel } });
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterReverb = new Tone.Reverb({ decay: 8, wet: 0.2 }).toDestination();

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "fatsine2" }, 
                envelope: { attack: 0.03, decay: 0.2, sustain: 0.4, release: 1 }
            }).connect(masterReverb);

            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(400, "highpass").toDestination());
            noiseSynth.start();

            const waterFilter = new Tone.AutoFilter("0.2n", 1000, 2).connect(masterReverb).start();
            waterFlow = new Tone.Noise("pink").connect(waterFilter);
            waterFlow.start();

            new Tone.Loop(time => {
                // High probability ensures you hear the changes
                if (Math.random() < 0.8) {
                    let scale = SCALES.high;
                    if (currentRatios.blue > 0.5) scale = SCALES.low;
                    else if (currentRatios.green > 0.5) scale = SCALES.mid;

                    const note = scale[Math.floor(Math.random() * scale.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time, 0.8);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            syncProbe(); // Trigger first scan
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
    map.whenReady(() => setTimeout(syncProbe, 200));
}

window.onload = init;