const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"], 
    mid: ["G3", "A3", "C4", "D4", "E4"],   
    low: ["C2", "G2", "C3", "Eb3"]         
};

let map, marker, chimePoly, noiseSynth, waterFlow, masterReverb, masterGain;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, green: 0.1 };
let debounceTimer; // The 'Lid' for our eye

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([40.7128, -74.0060], 14); // Start NYC
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    marker = L.marker([40.7128, -74.0060], { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    // 1. THE REVERSE GEOCODE SENSOR (UNIVERSAL)
    async function sampleEnvironment() {
        if (!isAudioActive) return;
        const latlng = marker.getLatLng();

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18`);
            const data = await res.json();
            
            const category = data.class; // water, highway, natural, etc.
            const type = data.type;      // river, residential, wood, etc.
            
            console.log(`Probe Sense: ${category} | ${type}`);

            if (category === "water" || type === "river" || category === "coastline") {
                currentRatios = { urban: 0.0, blue: 1.0, green: 0.0 };
            } else if (category === "natural" || category === "park" || type === "wood" || type === "forest") {
                currentRatios = { urban: 0.1, blue: 0.0, green: 0.9 };
            } else {
                currentRatios = { urban: 1.0, blue: 0.0, green: 0.0 };
            }
            
            updateAudioEngine();
        } catch (e) {
            console.warn("API throttled, maintaining current sound.");
        }
    }

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

        // DEBOUNCE: Only ask the API if the marker stays still for 200ms
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(sampleEnvironment, 200);
    }

    function updateAudioEngine() {
        const { urban, blue, green } = currentRatios;

        // Rhythm: Ocean is vibrant but slower
        const targetBPM = 50 + (urban * 90) - (blue * 12);
        Tone.Transport.bpm.rampTo(Math.max(45, targetBPM), 0.4);

        // Tone: High harmonicity for Forest shimmer
        chimePoly.set({ 
            modulationIndex: 12 * urban + 4 * blue + 2 * green,
            harmonicity: green > 0.5 ? 3.5 : (blue > 0.5 ? 1.5 : 2.5) 
        });

        // Volume Layers
        waterFlow.volume.rampTo(blue > 0.5 ? -24 : -80, 0.8);
        noiseSynth.volume.rampTo(urban > 0.5 ? -40 : -80, 0.6);

        // Release: Long and vibrant for nature
        const rel = 0.5 + (blue * 12) + (green * 4);
        chimePoly.set({ envelope: { release: rel } });
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(1, 1.2); // FADE IN

            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.25 }).connect(masterGain);

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "fatsine2" }, 
                envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 2 }
            }).connect(masterReverb);

            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(450, "highpass").connect(masterGain));
            noiseSynth.start();

            const waterFilter = new Tone.AutoFilter("0.2n", 1200, 2).connect(masterReverb).start();
            waterFlow = new Tone.Noise("pink").connect(waterFilter);
            waterFlow.start();

            new Tone.Loop(time => {
                if (Math.random() < 0.75) {
                    let scale = SCALES.high;
                    if (currentRatios.blue > 0.6) scale = SCALES.low;
                    else if (currentRatios.green > 0.5) scale = SCALES.mid;

                    const note = scale[Math.floor(Math.random() * scale.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time, 0.6);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            sampleEnvironment(); 
            startBtn.innerText = "PROBE ACTIVE";
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
    map.whenReady(() => setTimeout(syncProbe, 200));
}

window.onload = init;