const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"], 
    mid: ["G3", "A3", "C4", "D4", "E4"],   
    low: ["C2", "G2", "C3", "Eb3"]         
};

let map, marker, chimePoly, noiseSynth, waterFlow, masterReverb, masterGain;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, green: 0.1 };
let lastCheck = 0;

function init() {
    // 1. START AT CENTRAL PROVIDENCE (Kennedy Plaza / Burnside Park)
    const CENTRAL_PVD = [41.8245, -71.4128];
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(CENTRAL_PVD, 16);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(CENTRAL_PVD, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    // 2. THE SENSOR WITH VISUAL FEEDBACK
    async function sampleEnvironment() {
        if (!isAudioActive) return;
        
        const now = Date.now();
        if (now - lastCheck < 900) return; // Wait 900ms between pings to avoid blocks
        lastCheck = now;

        const latlng = marker.getLatLng();
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18`);
            const data = await res.json();
            
            const cat = data.class || ""; 
            const type = data.type || ""; 
            
            // Log to console so you can see it working
            console.log(`Probe Sense: ${cat} | ${type}`);

            // Robust Land-Use Mapping
            const isWater = cat === "water" || type.includes("river") || type.includes("canal") || cat === "coastline";
            const isNature = cat === "natural" || cat === "park" || type === "wood" || type === "forest" || type === "garden" || type === "grass";

            if (isWater) {
                currentRatios = { urban: 0.05, blue: 0.95, green: 0.0 };
                marker.getElement().style.filter = "hue-rotate(180deg)"; // Turn Blue
            } else if (isNature) {
                currentRatios = { urban: 0.1, blue: 0.05, green: 0.85 };
                marker.getElement().style.filter = "hue-rotate(90deg)"; // Turn Green
            } else {
                currentRatios = { urban: 0.9, blue: 0.05, green: 0.05 };
                marker.getElement().style.filter = "none"; // Default
            }
            
            updateAudioEngine();
        } catch (e) {
            console.warn("Sensor Blocked by API limits. Move slower!");
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

        sampleEnvironment();
    }

    function updateAudioEngine() {
        const { urban, blue, green } = currentRatios;
        const targetBPM = 55 + (urban * 85) - (blue * 12);
        Tone.Transport.bpm.rampTo(Math.max(50, targetBPM), 0.5);

        chimePoly.set({ 
            modulationIndex: 12 * urban + 4 * blue + 3 * green,
            harmonicity: green > 0.5 ? 3.5 : (blue > 0.5 ? 1.4 : 2.5) 
        });

        // Ensure these sounds actually cut out when not detected
        waterFlow.volume.rampTo(blue > 0.5 ? -20 : -80, 0.8);
        noiseSynth.volume.rampTo(urban > 0.5 ? -35 : -80, 0.8);

        const rel = 0.4 + (blue * 10) + (green * 4);
        chimePoly.set({ envelope: { release: rel } });
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(1, 1.2); 

            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.25 }).connect(masterGain);

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "fatsine2" }, 
                envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 2 }
            }).connect(masterReverb);

            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(480, "highpass").connect(masterGain));
            noiseSynth.start();

            const waterFilter = new Tone.AutoFilter("0.2n", 1100, 2).connect(masterReverb).start();
            waterFlow = new Tone.Noise("pink").connect(waterFilter);
            waterFlow.start();

            new Tone.Loop(time => {
                if (Math.random() < 0.8) {
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
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
}

window.onload = init;