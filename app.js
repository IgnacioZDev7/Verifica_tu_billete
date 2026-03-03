// ============================================================
// ⚙️  EDITÁ ESTAS 2 LÍNEAS CON TUS CREDENCIALES DE SUPABASE
// ============================================================
const SUPABASE_URL      = "https://lwuhrcxsreoshhtezybd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dWhyY3hzcmVvc2hodGV6eWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTQyNzEsImV4cCI6MjA4Nzk5MDI3MX0.Jb5qDfSY6_rgbjvb_usHsJXas9mDDKzSrXvkZ6zGVfk";
const CLAUDE_API_KEY    = ""; // opcional — dejalo vacío si no lo tenés aún
// ============================================================
console.log('%c Verificador BCB v1.9 cargado ', 'background: #c9a84c; color: #000; font-weight: bold;');


// ────────────────────────────────────────────────────────────
// CONSULTA A SUPABASE
// Busca si el número del billete cae dentro de algún rango
// inhabilitado con la misma letra de serie y denominación.
//
// La tabla billetes_inhabilitados tiene estas columnas:
//   id, serie (varchar), numero_inicio (int8),
//   numero_fin (int8), denominacion (int4), fecha_registro
// ────────────────────────────────────────────────────────────
async function consultarSupabase(serie, numero, denominacion) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/billetes_inhabilitados`);
  url.searchParams.set("select",        "id,serie,numero_inicio,numero_fin,denominacion");
  url.searchParams.set("serie",         `eq.${serie.toUpperCase()}`);
  url.searchParams.set("denominacion",  `eq.${denominacion}`);
  url.searchParams.set("numero_inicio", `lte.${numero}`); // el rango empieza ANTES
  url.searchParams.set("numero_fin",    `gte.${numero}`); // el rango termina DESPUÉS
  url.searchParams.set("limit",         "1");

  const res = await fetch(url.toString(), {
    headers: {
      "apikey":        SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type":  "application/json"
    }
  });

  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const data = await res.json();

  // null   = no está en ningún rango = HABILITADO
  // objeto = está dentro de un rango = INHABILITADO
  return data.length > 0 ? data[0] : null;
}


// ────────────────────────────────────────────────────────────
// PARSEAR NÚMERO DE SERIE
// Acepta: "B12345678", "B 12345678", "b-12345678", "B.12345678"
// Devuelve: { serie: "B", numero: 12345678 } o null
// ────────────────────────────────────────────────────────────
function parsearSerie(raw) {
  const limpio = raw.replace(/[\s\-\.]/g, '').toUpperCase();
  // Formato 1: Letra al principio (B12345678)
  const matchPrincipio = limpio.match(/^([A-Z]+)(\d+)$/);
  if (matchPrincipio) {
    return { serie: matchPrincipio[1], numero: parseInt(matchPrincipio[2], 10) };
  }
  // Formato 2: Letra al final (043773774 B)
  const matchFinal = limpio.match(/^(\d+)([A-Z]+)$/);
  if (matchFinal) {
    return { serie: matchFinal[2], numero: parseInt(matchFinal[1], 10) };
  }
  return null;
}


// ────────────────────────────────────────────────────────────
// HELPERS DE UI
// ────────────────────────────────────────────────────────────
function showResult(label, status, desc) {
  const successModal = document.getElementById('success-modal');
  const errorModal   = document.getElementById('error-modal');
  
  // Ocultar ambos primero
  successModal.classList.add('hidden'); successModal.classList.remove('flex');
  errorModal.classList.add('hidden');   errorModal.classList.remove('flex');

  if (status === 'ok') {
    document.getElementById('success-serie').textContent = 'SERIE: ' + label.toUpperCase();
    document.getElementById('success-desc').textContent  = desc;
    successModal.classList.remove('hidden');
    successModal.classList.add('flex');
  } else {
    // bad o warn se muestran en el modal de error/alerta
    document.getElementById('error-serie').textContent = 'SERIE: ' + label.toUpperCase();
    document.getElementById('error-desc').textContent  = desc;
    errorModal.classList.remove('hidden');
    errorModal.classList.add('flex');
  }
}

// Cerrar modales
document.querySelectorAll('.clear-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('success-modal').classList.add('hidden');
    document.getElementById('success-modal').classList.remove('flex');
    document.getElementById('error-modal').classList.add('hidden');
    document.getElementById('error-modal').classList.remove('flex');
  });
});

function setProcessing(on, msg = '') {
  const proc = document.getElementById('processing');
  if (on) {
    proc.classList.add('active');
    document.getElementById('processingMsg').textContent = msg;
  } else {
    proc.classList.remove('active');
  }
}


// ────────────────────────────────────────────────────────────
// FLUJO PRINCIPAL DE VERIFICACIÓN
// ────────────────────────────────────────────────────────────
async function verificar(serieRaw, denominacion) {
  if (!serieRaw.trim()) {
    showResult('—', 'warn', 'Ingresá el número de serie del billete.');
    return;
  }
  if (!denominacion) {
    showResult(serieRaw, 'warn', 'Seleccioná la denominación del billete (Bs 10, 20 o 50).');
    return;
  }

  const parsed = parsearSerie(serieRaw);
  if (!parsed) {
    showResult(serieRaw, 'warn',
      'Formato no reconocido. El número de serie debe empezar con una letra. Ejemplo: B12345678');
    return;
  }

  setProcessing(true, 'Consultando base de datos BCB…');
  try {
    const hit = await consultarSupabase(parsed.serie, parsed.numero, parseInt(denominacion));
    setProcessing(false);

    if (hit) {
      showResult(
        serieRaw, 'bad',
        `Billete INHABILITADO. Pertenece al rango ${hit.serie}${hit.numero_inicio}–` +
        `${hit.serie}${hit.numero_fin} (Bs ${hit.denominacion}). ` +
        `Fue sustraído en el accidente de El Alto. No debe circular.`
      );
    } else {
      showResult(
        serieRaw, 'ok',
        'Este billete NO está en ningún rango inhabilitado y puede circular con normalidad.'
      );
    }
  } catch (err) {
    setProcessing(false);
    console.error(err);
    showResult(serieRaw, 'warn', 'Error al consultar la base de datos: ' + err.message);
  }
}


// ────────────────────────────────────────────────────────────
// OCR CON TESSERACT.JS
// Lee el número de serie directamente desde la foto.
// Modo 7 = trata la imagen como una sola línea de texto.
// ────────────────────────────────────────────────────────────
async function ocrTesseract(imageSource) {
  console.log('Iniciando ocrTesseract con Tesseract.recognize (v5)...');
  // imageSource puede ser Blob, File o DataURL
  if (typeof Tesseract === 'undefined') {
    throw new Error('La librería Tesseract.js no se detectó. Verificá tu conexión a internet.');
  }

  try {
    const result = await Tesseract.recognize(
      imageSource,
      'eng',
      {
        workerBlobURL: true,
        logger: m => console.log('Tesseract:', m),
        // Restringimos caracteres para evitar confusiones (O vs 0, etc)
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
      }
    );

    console.log('Reconocimiento completado con éxito.');
    return result.data.text.trim();
  } catch (ocrErr) {
    console.error('Error crítico en Tesseract.recognize:', ocrErr);
    throw ocrErr;
  }
}


// ────────────────────────────────────────────────────────────
// OCR CON CLAUDE VISION (fallback)
// Se activa solo si Tesseract no detectó nada Y tenés API key.
// ────────────────────────────────────────────────────────────
async function ocrClaude(base64, mimeType) {
  if (!CLAUDE_API_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 60,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
            { type: "text",  text: "Extraé SOLO el número de serie del billete boliviano. Formato: letra(s) seguidas de números, ej: B12345678. Respondé ÚNICAMENTE con el número de serie. Si no podés leerlo claramente respondé: NO_DETECTADO" }
          ]
        }]
      })
    });
    const data = await res.json();
    const txt  = data.content?.[0]?.text?.trim();
    return (!txt || txt === 'NO_DETECTADO') ? null : txt;
  } catch (e) {
    console.error('Claude OCR error:', e);
    return null;
  }
}


// ────────────────────────────────────────────────────────────
// PROCESAR IMAGEN (viene de cámara o de archivo subido)
// ────────────────────────────────────────────────────────────
async function processImage(blob) {
  if (!blob) {
    showResult('—', 'warn', 'No se recibió ninguna imagen (blob vacío).');
    return;
  }

  setProcessing(true, 'Leyendo imagen con OCR…');
  document.getElementById('debugBox').classList.remove('active');
  document.getElementById('resultCard').className = 'result-card';

  const denom = document.getElementById('denomSelect').value;

  try {
    console.log('Procesando imagen, tamaño:', blob.size, 'tipo:', blob.type);
    
    // Intento 1 — Tesseract (acepta Blobs/Files directamente)
    let serial = '', method = 'Tesseract';
    const rawText = await ocrTesseract(blob);
    
    if (rawText) {
      console.log('Texto RAW detectado:', rawText);
      // Limpieza pre-regex: corregir confusiones comunes (O -> 0, I -> 1) en zonas de números
      let cleanText = rawText.toUpperCase().replace(/[OI]/g, (m) => m === 'O' ? '0' : '1');
      
      // Busca patrones como A12345678 o 12345678A
      const match = cleanText.match(/([A-Z]\s*\d{7,10})|(\d{7,10}\s*[A-Z])/);
      if (match) serial = match[0].replace(/\s/g, '');
    }

    // Intento 2 — Claude Vision (solo si es necesario)
    if (!serial && CLAUDE_API_KEY) {
      setProcessing(true, 'Usando Claude Vision como respaldo…');
      console.log('Tesseract falló, preparando conversión para Claude...');
      
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      const mimeType = blob.type || 'image/jpeg';
      
      const claudeResult = await ocrClaude(base64, mimeType);
      if (claudeResult) { serial = claudeResult; method = 'Claude Vision'; }
    }

    if (serial) {
      document.getElementById('debugText').textContent = `${method} detectó: ${serial.toUpperCase()}`;
      document.getElementById('debugBox').classList.add('active');
      document.getElementById('serieInput').value = serial.toUpperCase();
    }

    setProcessing(false);

    if (!serial) {
      showResult('—', 'warn',
        'No se pudo extraer texto claro de la serie. ' +
        'Recomendación: Acercá más el billete al recuadro o ingresalo manualmente.');
      return;
    }

    await verificar(serial, denom);

  } catch (err) {
    setProcessing(false);
    console.error('Error detallado en processImage:', err);
    
    // Manejo de errores ultra-robusto
    let errorMsg = 'Error desconocido';
    try {
      if (err) {
        errorMsg = err.message || (typeof err === 'string' ? err : JSON.stringify(err)) || String(err);
      }
    } catch (e) {
      errorMsg = 'Error no serializable';
    }
    
    // Evitar que el mensaje final sea literalmente "undefined"
    if (errorMsg === 'undefined' || !errorMsg) errorMsg = 'Error de procesamiento interno';

    showResult('—', 'warn', 'v1.9 Error: ' + errorMsg);
    alert('DEBUG v1.9: ' + errorMsg);
  }
}


// ────────────────────────────────────────────────────────────
// CÁMARA
// ────────────────────────────────────────────────────────────
let stream = null;
let track = null;
const video = document.getElementById('video');

document.getElementById('btnCamera').addEventListener('click', async () => {
  const btn = document.getElementById('btnCamera');

  if (stream) {
    // Apagar cámara
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    video.srcObject = null;
    btn.textContent = '📷 Activar cámara';
    document.getElementById('btnCapture').disabled = true;
    document.getElementById('scannerFrame').style.display = 'none';
    document.getElementById('labelOverlay').style.display = 'none';
    document.getElementById('cameraOffMsg').style.display = 'flex';
    return;
  }

  // Encender cámara (pide permiso al usuario)
  setProcessing(true, 'Iniciando cámara...');
  try {
    const constraints = [
      { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: 'environment' } },
      { video: true }
    ];

    let lastErr = null;
    for (const constraint of constraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraint);
        if (stream) break;
      } catch (err) {
        lastErr = err;
        console.warn('Fallo con restricción:', constraint, err);
      }
    }

    if (!stream) throw lastErr || new Error('No se pudo obtener acceso a ninguna cámara.');

    video.srcObject = stream;
    
    // Intentar reproducir directamente
    btn.textContent = '🛑 Detener cámara';
    document.getElementById('btnCapture').disabled = false;
    document.getElementById('scannerFrame').style.display = 'flex';
    document.getElementById('labelOverlay').style.display = 'block';
    document.getElementById('cameraOffMsg').style.display = 'none';

    try {
      await video.play();
    } catch (playErr) {
      console.warn('Error en video.play(), intentando de nuevo al cargar metadatos...', playErr);
      video.onloadedmetadata = () => video.play().catch(e => console.error('Fallo final video.play():', e));
    }
    
    // Esperar un poco para detectar flash
    setTimeout(() => {
      try {
        track = stream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const caps = track.getCapabilities();
          if (caps.torch) {
            document.getElementById('btnFlash').style.display = 'block';
          }
        }
      } catch (e) {
        console.warn('Error detectando flash:', e);
      }
    }, 1000);

  } catch (e) {
    console.error('Error al encender cámara:', e);
    alert('Error al encender cámara: ' + (e.message || e));
  } finally {
    setProcessing(false);
  }
});

let torchOn = false;
document.getElementById('btnFlash').addEventListener('click', async () => {
  if (!track) return;
  try {
    torchOn = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    document.getElementById('btnFlash').textContent = torchOn ? '🔦 Flash On' : '🔦 Flash Off';
  } catch (e) {
    console.warn('No se pudo activar el flash:', e);
  }
});

document.getElementById('btnCapture').addEventListener('click', () => {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    alert('La cámara aún no está lista. Esperá un momento.');
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(blob => processImage(blob), 'image/jpeg', 0.95);
});


// ────────────────────────────────────────────────────────────
// SUBIR IMAGEN DESDE GALERÍA
// ────────────────────────────────────────────────────────────
document.getElementById('btnUpload').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processImage(file);
  e.target.value = ''; // reset para poder subir el mismo archivo dos veces
});


// ────────────────────────────────────────────────────────────
// VERIFICACIÓN MANUAL
// ────────────────────────────────────────────────────────────
document.getElementById('btnVerify').addEventListener('click', () => {
  verificar(
    document.getElementById('serieInput').value.trim(),
    document.getElementById('denomSelect').value
  );
});

// También funciona presionando Enter desde el input
document.getElementById('serieInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btnVerify').click();
});