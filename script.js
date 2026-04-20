const SCALES = {
    high: ["C4", "Eb4", "G4", "Bb4", "C5"], 
    mid: ["G3", "A3", "C4", "D4", "E4"],   
    low: ["C2", "G2", "C3", "Eb3"]         
};

// HAND-CODED GEOGRAPHY
const ZONES = {
    PVD: { center: [41.8245, -71.4128], radius: 2500 }, // Providence
    BOS: { center: [42.3601, -71.0589], radius: 4000 }, // Boston
    NYC: { center: [40.7128, -74.0060], radius: 6000 }, // New York
    WOR: { center: [42.2626, -71.8023], radius: 2000 }, // Worcester
    NHV: { center: [41.3083, -72.9279], radius: 2000 }  // New Haven
};

let map, marker, chimePoly, noiseSynth, waterFlow, masterReverb, masterGain;
let isAudioActive = false;
let currentRatios = { urban: 0.5, blue: 0.1, green: 0.1 };

function init() {
    // STARTING LOCATION: Kennedy Plaza, Providence
    const startPos = [41.8245, -71.4128];
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 15);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value'); // Make sure this ID exists in HTML
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function detectZone(latlng) {
        let inUrban = false;
        
        // Check if we are inside any of our hand-coded big city circles
        for (let key in ZONES) {
            const zone = ZONES[key];
            const dist = latlng.distanceTo(zone.center);
            if (dist < zone.radius) {
                inUrban = true;
                break;
            }
        }

        // WATER LOGIC (Coastal / River checks)
        const isNearWater = (latlng.lng > -71.405 && latlng.lat < 41.818) || // PVD River
                            (latlng.lng > -71.050 && latlng.lat < 42.360) || // BOS Harbor
                            (latlng.lng > -74.020 && latlng.lng < -73.98);   // NYC Rivers

        if (isNearWater) {
            currentRatios = { urban: 0.1, blue: 0.9, green: 0.0 };
        } else if (inUrban) {
            currentRatios = { urban: 0.9, blue: 0.05, green: 0.05 };
        } else {
            currentRatios = { urban: 0.2, blue: 0.1, green: 0.7 };
        }
        
        if (isAudioActive) updateAudioEngine();
    }

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        
        // FIX: Update the slider number display
        if (radiusDisplay) {
            radiusDisplay.innerText = radiusMeters + "m";
        }

        const centerLatLng = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(centerLatLng);
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const fullPath = `M 0 0 H ${w} V ${h} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        
        frost.style.clipPath = `path('${fullPath}')`;
        detectZone(centerLatLng);
    }

    function updateAudioEngine() {
        const { urban, blue, green } = currentRatios;
        const targetBPM = 55 + (urban * 85) - (blue * 12);
        Tone.Transport.bpm.rampTo(Math.max(50, targetBPM), 0.2);

        chimePoly.set({ 
            modulationIndex: 12 * urban + 4 * blue + 3 * green,
            harmonicity: green > 0.5 ? 3.5 : (blue > 0.5 ? 1.4 : 2.5) 
        });

        waterFlow.volume.rampTo(blue > 0.5 ? -20 : -80, 0.4);
        noiseSynth.volume.rampTo(urban > 0.5 ? -35 : -80, 0.4);

        const rel = 0.5 + (blue * 10) + (green * 4);
        chimePoly.set({ envelope: { release: rel } });
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(1, 1.0); 

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
            syncProbe();
            startBtn.innerText = "PROBE ONLINE";
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom drag', syncProbe);
    marker.on('drag', syncProbe);
}

window.onload = init;