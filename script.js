const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"], 
    mid: ["G3", "A3", "C4", "D4", "E4"],   
    low: ["C2", "G2", "C3", "Eb3"]         
};

let map, marker, chimePoly, noiseSynth, waterFlow, masterReverb, masterGain;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, green: 0.1 };
let debounceTimer;

function init() {
    // BACK TO PROVIDENCE: RISD / Brown University Area
    const PVD_COORDS = [41.8268, -71.4025];
    
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(PVD_COORDS, 15);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: 'OpenStreetMap'
    }).addTo(map);

    marker = L.marker(PVD_COORDS, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    async function sampleEnvironment() {
        if (!isAudioActive) return;
        const latlng = marker.getLatLng();

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18`);
            const data = await res.json();
            
            const category = data.class || ""; 
            const type = data.type || "";      
            
            console.log(`Probe Sense: ${category} | ${type}`);

            if (category === "water" || type.includes("river") || category === "coastline") {
                currentRatios = { urban: 0.05, blue: 0.9, green: 0.05 };
            } else if (category === "natural" || category === "park" || type === "wood" || type === "forest") {
                currentRatios = { urban: 0.1, blue: 0.05, green: 0.85 };
            } else {
                currentRatios = { urban: 0.9, blue: 0.05, green: 0.05 };
            }
            
            updateAudioEngine();
        } catch (e) {
            console.warn("API throttle - keeping state.");
        }
    }

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = `${radiusMeters}m`;

        const centerLatLng = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(centerLatLng);
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const fullPath = `M 0 0 H ${w} V ${h} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(sampleEnvironment, 250);
    }

    function updateAudioEngine() {
        const { urban, blue, green } = currentRatios;
        
        // Ensure BPM never drops to 0 (which causes the 'stuck' feeling)
        const targetBPM = 55 + (urban * 85) - (blue * 10);
        Tone.Transport.bpm.rampTo(Math.max(50, targetBPM), 0.5);

        chimePoly.set({ 
            modulationIndex: 12 * urban + 4 * blue + 3 * green,
            harmonicity: green > 0.5 ? 3.5 : (blue > 0.5 ? 1.4 : 2.5) 
        });

        waterFlow.volume.rampTo(blue > 0.5 ? -22 : -80, 1.0);
        noiseSynth.volume.rampTo(urban > 0.5 ? -38 : -80, 0.8);

        const rel = 0.5 + (blue * 12) + (green * 4);
        chimePoly.set({ envelope: { release: rel } });
        
        // RESTART WATCHDOG: If Transport stopped, restart it
        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
        }
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(1, 1.5); 

            masterReverb = new Tone.Reverb({ decay: 9, wet: 0.25 }).connect(masterGain);

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "fatsine2" }, 
                envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 2 }
            }).connect(masterReverb);

            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(480, "highpass").connect(masterGain));
            noiseSynth.start();

            const waterFilter = new Tone.AutoFilter("0.2n", 1100, 2).connect(masterReverb).start();
            waterFlow = new Tone.Noise("pink").connect(waterFilter);
            waterFlow.start();

            // FIXED LOOP: Higher probability and strictly timed
            new Tone.Loop(time => {
                // Ensure nodes fire even in nature (85% probability)
                if (Math.random() < 0.85) {
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
            startBtn.innerText = "SYSTEM ACTIVE";
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
    map.whenReady(() => setTimeout(syncProbe, 200));
}

window.onload = init;