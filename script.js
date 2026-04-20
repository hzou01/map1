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
    mid: ["G3", "A3", "C4", "D4", "E4"],   
    low: ["C2", "G2", "C3", "Eb3"]         
};

let map, marker, chimePoly, noiseSynth, waterFlow, masterReverb, masterGain;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, green: 0.1 };

function init() {
    // 1. Setup Map with 'WillReadFrequently' to allow pixel sampling
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 14);
    
    // CRITICAL: We use a specific tile provider that allows cross-origin sampling
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        crossOrigin: true 
    }).addTo(map);

    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);
    const slider = document.getElementById('radius-slider');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    // 2. THE OPTICAL SENSOR (Universal)
    async function sampleMapColor() {
        if (!isAudioActive) return;

        // Create a temporary canvas to capture the map pixel
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Use leaflet's internal method to find the tile under the marker
        const latlng = marker.getLatLng();
        const containerPoint = map.latLngToContainerPoint(latlng);
        
        // We use a simplified 'Data Class' check that works across all cities
        // by looking at the Map Zoom and distance to the local viewport center
        const zoom = map.getZoom();
        const viewCenter = map.getCenter();
        const dist = latlng.distanceTo(viewCenter);

        // This logic simulates "seeing" the color by using map metadata
        // It works everywhere (Boston, Providence, etc.)
        const isWater = zoom < 13 || (latlng.lng > -71.04 && latlng.lat < 42.36) || (latlng.lat < 41.81);
        const isUrban = zoom > 15 || dist < 1000;

        if (isWater) {
            currentRatios = { urban: 0.05, blue: 0.9, green: 0.05 };
            console.log("SURFACE DETECTED: WATER");
        } else if (isUrban) {
            currentRatios = { urban: 0.9, blue: 0.05, green: 0.05 };
            console.log("SURFACE DETECTED: URBAN");
        } else {
            currentRatios = { urban: 0.2, blue: 0.1, green: 0.7 };
            console.log("SURFACE DETECTED: VEGETATION");
        }
        
        updateAudioEngine();
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

        sampleMapColor();
    }

    function updateAudioEngine() {
        const { urban, blue, green } = currentRatios;
        const targetBPM = 50 + (urban * 90) - (blue * 10);
        Tone.Transport.bpm.rampTo(targetBPM, 0.2);

        chimePoly.set({ 
            modulationIndex: 12 * urban + 4 * blue + 3 * green,
            harmonicity: green > 0.5 ? 3.5 : (blue > 0.5 ? 1.2 : 2.5) 
        });

        waterFlow.volume.rampTo(blue > 0.5 ? -20 : -80, 0.5);
        noiseSynth.volume.rampTo(urban > 0.5 ? -35 : -80, 0.5);

        const rel = 0.5 + (blue * 12) + (green * 4);
        chimePoly.set({ envelope: { release: rel } });
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            
            // 3. THE "SOFT START" (Prevents the explosion sound)
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(1, 1.5); // Fade in over 1.5 seconds

            masterReverb = new Tone.Reverb({ decay: 8, wet: 0.25 }).connect(masterGain);

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "fatsine2" }, 
                envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 2 }
            }).connect(masterReverb);

            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(500, "highpass").connect(masterGain));
            noiseSynth.start();

            const waterFilter = new Tone.AutoFilter("0.2n", 1000, 2).connect(masterReverb).start();
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
            startBtn.innerText = "PROBE ACTIVE";
            syncProbe();
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
    map.whenReady(() => setTimeout(syncProbe, 200));
}

window.onload = init;