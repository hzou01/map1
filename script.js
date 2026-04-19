let map, marker, chimePoly, natureBase, waterPad;
let isAudioActive = false;
let ratios = { green: 0.3, gray: 0.5, blue: 0.2 }; 

// Updated Scales for depth
const HIGH_CHIMES = ["C5", "D5", "G5", "A5", "C6"]; 
const MID_PAD = ["G3", "A3", "C4", "D4"]; // The "Medium" Tones
const DEEP_BASE = ["C2", "G2", "C1"];    // The "Low" Tones

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        const centerPoint = map.latLngToContainerPoint(marker.getLatLng());
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = radiusMeters / metersPerPixel;

        const holeX = centerPoint.x + 100; 
        const holeY = centerPoint.y + 100;
        const fullPath = `M 0 0 H ${window.innerWidth + 200} V ${window.innerHeight + 200} H 0 Z M ${holeX} ${holeY} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;
        
        updateAudioParams();
    }

    function updateAudioParams() {
        if (!isAudioActive) return;

        // URBAN: Speed + Grit
        const urbanTempo = 80 + (ratios.gray * 120); 
        Tone.Transport.bpm.rampTo(urbanTempo, 1);
        chimePoly.volume.rampTo(-15 + (ratios.gray * 10), 0.5);

        // NATURE (BASS): Forcing it to be "Obvious"
        // Base volume is higher (-25) and swells to -5
        natureBase.volume.rampTo(-25 + (ratios.green * 20), 1);
        
        // WATER (MID): The "Cloudy" layer swell
        waterPad.volume.rampTo(-30 + (ratios.blue * 25), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();

            // HIGH LAYER: Soft Chimes
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 2,
                envelope: { attack: 0.1, release: 1.5 }
            }).toDestination();

            // MID LAYER: Warm Triangle Pad (The "Medium" Tone)
            waterPad = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 2, release: 6 }
            }).toDestination();

            // LOW LAYER: Deep Sine (The "Base")
            natureBase = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 1, release: 8 }
            }).toDestination();

            // GENERATIVE LOOP
            new Tone.Loop(time => {
                // Urban (Always fast 16th notes, probability changes)
                if (Math.random() < (0.1 + ratios.gray * 0.8)) {
                    const note = HIGH_CHIMES[Math.floor(Math.random() * HIGH_CHIMES.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time);
                }

                // TRIGGER BASS & MID: On every single downbeat for maximum presence
                if (Tone.Transport.getTicksAtTime(time) % Tone.Ticks("1n").toNumber() === 0) {
                    
                    // The Deep Base (Green)
                    if (Math.random() < (ratios.green + 0.3)) {
                        const bNote = DEEP_BASE[Math.floor(Math.random() * DEEP_BASE.length)];
                        natureBase.triggerAttackRelease(bNote, "1n", time);
                    }
                    
                    // The Cloudy Mid-Tone (Blue)
                    if (Math.random() < (ratios.blue + 0.3)) {
                        const mNote = MID_PAD[Math.floor(Math.random() * MID_PAD.length)];
                        waterPad.triggerAttackRelease(mNote, "2n", time);
                    }
                }
            }, "8n").start(0);

            Tone.Transport.start();
            startBtn.innerText = "PROBE ACTIVE";
            isAudioActive = true;
        } catch (err) { console.error(err); }
    };

    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);
    marker.on('dragend', () => {
        ratios.green = Math.random(); 
        ratios.gray = Math.random();
        ratios.blue = 1 - (ratios.green + ratios.gray);
        syncProbe();
    });
    setTimeout(syncProbe, 100);
}

window.onload = init;