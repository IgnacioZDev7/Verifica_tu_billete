/**
 * UNIFRANZ - Validador de Billetes
 * Lógica funcional: Supabase, OCR, Cámara e Interfaz
 */

// Configuración Supabase
const SUPABASE_URL      = "https://lwuhrcxsreoshhtezybd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dWhyY3hzcmVvc2hodGV6eWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTQyNzEsImV4cCI6MjA4Nzk5MDI3MX0.Jb5qDfSY6_rgbjvb_usHsJXas9mDDKzSrXvkZ6zGVfk";

document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias UI ---
    const video = document.getElementById('video');
    const scanBtn = document.getElementById('scan-btn');
    const captureBtn = document.getElementById('capture-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('fileInput');
    const flashBtn = document.getElementById('btnFlash');
    
    const serieNumInput = document.getElementById('serie-num-input');
    const serieLetterInput = document.getElementById('serie-letter-input');
    const denomButtons = document.querySelectorAll('.denom-btn');
    
    const successModal = document.getElementById('success-modal');
    const errorModal = document.getElementById('error-modal');
    const clearButtons = document.querySelectorAll('.clear-btn');
    
    const successSerieTxt = document.getElementById('success-serie');
    const successDescTxt = document.getElementById('success-desc');
    const errorSerieTxt = document.getElementById('error-serie');
    const errorDescTxt = document.getElementById('error-desc');

    let selectedDenom = null;
    let stream = null;
    let track = null;
    let torchOn = false;

    // --- Lógica de Denominación ---
    denomButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            denomButtons.forEach(b => b.classList.remove('ring-2', 'ring-white', 'opacity-100'));
            btn.classList.add('ring-2', 'ring-white', 'opacity-100');
            selectedDenom = btn.dataset.value;
        });
    });

    // --- Funciones de Verificación ---
    async function consultarSupabase(serie, numero, denominacion) {
        const url = new URL(`${SUPABASE_URL}/rest/v1/billetes_inhabilitados`);
        url.searchParams.set("select",        "id,serie,numero_inicio,numero_fin,denominacion");
        url.searchParams.set("serie",         `eq.${serie.toUpperCase()}`);
        url.searchParams.set("denominacion",  `eq.${denominacion}`);
        url.searchParams.set("numero_inicio", `lte.${numero}`);
        url.searchParams.set("numero_fin",    `gte.${numero}`);
        url.searchParams.set("limit",         "1");

        const res = await fetch(url.toString(), {
            headers: {
                "apikey":        SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type":  "application/json"
            }
        });

        if (!res.ok) throw new Error(`Error DB: ${res.status}`);
        const data = await res.json();
        return data.length > 0 ? data[0] : null;
    }

    async function verificar(serieLetra, serieNum, denominacion) {
        if (!serieLetra || !serieNum) {
            alert('Por favor, ingresa la letra y el número de serie.');
            return;
        }
        if (!denominacion) {
            alert('Por favor, selecciona una denominación (10, 20 o 50 Bs).');
            return;
        }

        const fullSerie = `${serieLetra}${serieNum}`.toUpperCase();
        console.log('Verificando:', fullSerie, 'Denom:', denominacion);

        try {
            const hit = await consultarSupabase(serieLetra, serieNum, parseInt(denominacion));
            
            if (hit) {
                showModal(errorModal, {
                    serie: fullSerie,
                    desc: `Billete INHABILITADO. Rango ${hit.serie}${hit.numero_inicio}–${hit.serie}${hit.numero_fin}. Sustraído en El Alto.`
                });
            } else {
                showModal(successModal, {
                    serie: fullSerie,
                    desc: 'Este billete NO se encuentra registrado como inhabilitado y puede circular normalmente.'
                });
            }
        } catch (err) {
            console.error(err);
            alert('Error al consultar la base de datos.');
        }
    }

    // --- Manejo de Modales ---
    function showModal(modal, data) {
        if (modal === successModal) {
            successSerieTxt.textContent = `SERIE: ${data.serie}`;
            successDescTxt.textContent = data.desc;
        } else {
            errorSerieTxt.textContent = `SERIE: ${data.serie}`;
            errorDescTxt.textContent = data.desc;
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function hideModals() {
        [successModal, errorModal].forEach(m => {
            m.classList.add('hidden');
            m.classList.remove('flex');
        });
    }

    clearButtons.forEach(btn => btn.addEventListener('click', hideModals));

    // --- Lógica de Cámara ---
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            video.srcObject = stream;
            scanBtn.classList.add('hidden');
            captureBtn.classList.remove('hidden');
            
            track = stream.getVideoTracks()[0];
            if (track && track.getCapabilities && track.getCapabilities().torch) {
                flashBtn.style.display = 'flex';
            }
        } catch (err) {
            console.error('Error cámara:', err);
            alert('No se pudo acceder a la cámara.');
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
            video.srcObject = null;
            flashBtn.style.display = 'none';
            torchOn = false;
        }
        scanBtn.classList.remove('hidden');
        captureBtn.classList.add('hidden');
    }

    scanBtn.addEventListener('click', startCamera);

    flashBtn.addEventListener('click', async () => {
        if (!track) return;
        try {
            torchOn = !torchOn;
            await track.applyConstraints({ advanced: [{ torch: torchOn }] });
        } catch (e) {
            console.warn('Flash no disponible');
        }
    });

    captureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(blob => processImage(blob), 'image/jpeg', 0.95);
        stopCamera();
    });

    // --- OCR y Procesamiento ---
    async function processImage(blob) {
        if (!selectedDenom) {
            alert('Selecciona una denominación antes de escanear.');
            return;
        }
        
        console.log('Iniciando OCR...');
        try {
            const result = await Tesseract.recognize(blob, 'eng', {
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            });
            
            const rawText = result.data.text.trim().toUpperCase().replace(/[OI]/g, m => m === 'O' ? '0' : '1');
            console.log('OCR detectó:', rawText);
            
            const match = rawText.match(/([A-Z])\s*(\d{7,10})|(\d{7,10})\s*([A-Z])/);
            if (match) {
                const letra = match[1] || match[4];
                const numero = match[2] || match[3];
                serieNumInput.value = numero;
                serieLetterInput.value = letra;
                verificar(letra, numero, selectedDenom);
            } else {
                alert('No se pudo leer el número de serie claramente. Intenta de nuevo o ingresalo manualmente.');
            }
        } catch (err) {
            console.error('OCR Error:', err);
            alert('Error al procesar la imagen.');
        }
    }

    // --- Subida de Archivo ---
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) processImage(e.target.files[0]);
        e.target.value = '';
    });

    // --- Verificación Manual ---
    serieNumInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verificar(serieLetterInput.value, serieNumInput.value, selectedDenom);
    });
    serieLetterInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verificar(serieLetterInput.value, serieNumInput.value, selectedDenom);
    });
});
