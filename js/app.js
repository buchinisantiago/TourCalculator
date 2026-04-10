import { calculateQuote, TOUR_DEFAULTS } from './calculator.js';

// ---- SUPABASE CONFIGURATION ----
// Reemplaza estos valores con la URL y KEY de tu proyecto Supabase.
const SUPABASE_URL = 'https://qgriwpjsslovkkmnlntg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZnEVeUYjF7ZII5An9ku5rw_1CrNo3Gl';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ---- DOM ELEMENTS ----
const form = document.getElementById('calculator-form');
const customTourSection = document.getElementById('custom-tour-section');
const errorBox = document.getElementById('error-box');
const ticketView = document.getElementById('ticket-view');
const breakdownLines = document.getElementById('breakdown-lines');
const btnCopy = document.getElementById('btn-copy');
const btnEmail = document.getElementById('btn-email');
const btnSave = document.getElementById('btn-save');
const saveStatus = document.getElementById('save-status');

// New Welcome UI
const welcomeForm = document.getElementById('welcome-form');
const welcomeStep = document.getElementById('welcome-step');
const calculatorWrap = document.getElementById('calculator-wrap');
const quoteSidebar = document.getElementById('quote-sidebar');

// Ticket Elements
const tTour = document.getElementById('ticket-tour');
const tDatetime = document.getElementById('ticket-datetime');
const tPax = document.getElementById('ticket-pax');
const tLang = document.getElementById('ticket-lang');
const tPrice = document.getElementById('ticket-price');
const tPricePax = document.getElementById('ticket-price-pax');
const tPriceEur = document.getElementById('ticket-price-eur');
const tSubtotals = document.getElementById('ticket-subtotals');

const DKK_TO_EUR = 7.46;

let currentQuote = null; // Store the latest calculation
let pricingConfig = null; // Store dynamic pricing from DB
let sessionUser = { name: '', email: '' }; // Store the authenticated agent from step 1
let currentLang = 'ESP'; // Global state for UI language
let isAdminMode = false; // Default to Customer View
const ADMIN_PW = 'Cached10s!';

const TRANSLATIONS = {
    ESP: {
        admin_panel: "Panel Administrador",
        welcome_title: "Tour Calculator",
        welcome_subtitle: "Por favor identifícate para continuar",
        name_label: "Nombre",
        email_label: "Email",
        enter_btn: "Ingresar a la Calculadora",
        basic_info: "Información Básica",
        is_cruise: "🚢 ¿Es un tour de desembarque? (Crucero)",
        pax_label: "Pasajeros (Pax)",
        lang_label: "Idioma del Tour",
        date_label: "Fecha",
        time_label: "Hora de Inicio",
        which_tour: "¿Qué tour deseas cotizar?",
        custom_options: "Opciones de Tour Personalizado",
        hours_label: "¿Cuántas horas?",
        needs_guide: "¿Necesitan guía de turismo?",
        venues_label: "Venues / Entradas (Opcional)",
        itinerary_label: "Itinerario / Notas especiales",
        itinerary_placeholder: "Describe los lugares a visitar o requerimientos especiales...",
        guide_label: "Guía",
        guides_label: "Guías",
        bus_label: "Bus",
        extra_note: "Incluye 30 min extra por llegada anticipada y coordinación con el chofer.",
        net_total: "Total Neto",
        markup: "Margen",
        yes: "Sí",
        no: "No",
        luggage_note: "🧳 <strong>Capacidad Reducida:</strong> Para tours de desembarque con maletas, se calcula un uso máximo del 70% de los asientos del bus.",
        auth_required: "Contraseña requerida",
        auth_subtitle: "Ingresa la contraseña para ver el desglose de precios.",
        cancel: "Cancelar",
        confirm: "Confirmar",
        header_subtitle: "Generador rápido de cotizaciones para agentes",
        info_transport: "Transporte",
        info_duration: "Duración",
        info_sights: "Puntos a visitar",
        info_includes: "Incluye",
        info_no_venues: "Sin venues incluidos"
    },
    ENG: {
        admin_panel: "Admin Panel",
        welcome_title: "Tour Calculator",
        welcome_subtitle: "Please identify yourself to continue",
        name_label: "Name",
        email_label: "Email",
        enter_btn: "Enter Calculator",
        basic_info: "Basic Info",
        is_cruise: "🚢 Is a disembarking tour? (Cruise)",
        pax_label: "Passengers (Pax)",
        lang_label: "Tour Language",
        date_label: "Date",
        time_label: "Start Time",
        which_tour: "Which tour do you want to quote?",
        custom_options: "Custom Tour Options",
        hours_label: "How many hours?",
        needs_guide: "Do they need a tour guide?",
        venues_label: "Venues (Optional)",
        itinerary_label: "Itinerary / Special Notes",
        itinerary_placeholder: "Describe the places to visit or special requirements...",
        guide_label: "Guide",
        guides_label: "Guides",
        bus_label: "Bus",
        extra_note: "Includes 30 min extra for early arrival and driver coordination.",
        net_total: "Net Total",
        markup: "Markup",
        total_pax: "per person",
        approx: "Approx.",
        copy_btn: "Copy Text",
        email_btn: "Email Invoice",
        save_btn: "Save & Record",
        yes: "Yes",
        no: "No",
        luggage_note: "🧳 <strong>Reduced Capacity:</strong> For disembarking tours with luggage, a max of 70% of bus seats are used.",
        auth_required: "Password required",
        auth_subtitle: "Enter the password to expand the price breakdown.",
        cancel: "Cancel",
        confirm: "Confirm",
        header_subtitle: "Quick quote generator for agents",
        info_transport: "Transport",
        info_duration: "Duration",
        info_sights: "Sights to visit",
        info_includes: "Includes",
        info_no_venues: "No venues included"
    },
    ITA: {
        admin_panel: "Pannello Amministratore",
        welcome_title: "Calcolatore Tour",
        welcome_subtitle: "Per favore identificati per continuare",
        name_label: "Nome",
        email_label: "Email",
        enter_btn: "Entra nel Calcolatore",
        basic_info: "Informazioni di Base",
        is_cruise: "🚢 È un tour di sbarco? (Crociera)",
        pax_label: "Passeggeri (Pax)",
        lang_label: "Lingua",
        date_label: "Data",
        time_label: "Ora di Inizio",
        which_tour: "Quale tour vuoi quotare?",
        custom_options: "Opzioni Tour Personalizzato",
        hours_label: "Quante ore?",
        needs_guide: "Hanno bisogno di una guida?",
        venues_label: "Venues (Opzionale)",
        itinerary_label: "Itinerario / Note speciali",
        itinerary_placeholder: "Descrivi i luoghi da visitare o richieste speciali...",
        guide_label: "Guida",
        guides_label: "Guide",
        bus_label: "Bus",
        extra_note: "Include 30 min extra per arrivo anticipato e coordinamento con l'autista.",
        net_total: "Totale Netto",
        markup: "Margine",
        total_pax: "per persona",
        approx: "Appross.",
        copy_btn: "Copia Testo",
        email_btn: "Invia per Email",
        save_btn: "Salva e Registra",
        other: "ALTRO",
        yes: "Sì",
        no: "No",
        luggage_note: "🧳 <strong>Capacità Ridotta:</strong> Per i tour di sbarco con bagagli, viene utilizzato al massimo il 70% dei posti sull'autobus.",
        auth_required: "Password richiesta",
        auth_subtitle: "Inserisci la password per visualizzare il dettaglio dei prezzi.",
        cancel: "Annulla",
        confirm: "Conferma",
        header_subtitle: "Generatore rapido di preventivi per agenti",
        info_transport: "Trasporto",
        info_duration: "Durata",
        info_sights: "Punti da visitare",
        info_includes: "Include",
        info_no_venues: "Nessun venue incluso"
    }
};

function translateTourText(text, lang) {
    if (!text || lang === 'ESP') return text;
    
    const dict = {
        ENG: {
            "Caminata": "Walking",
            "Paseo a pie": "Walking",
            "Bote por canales": "Canal Boat",
            "Bote": "Boat",
            "Traslado directo": "Direct Transfer",
            "La Sirenita": "Little Mermaid",
            "Regreso al puerto": "Return to port",
            "Vistas panorámicas principales": "Main panoramic views",
            "Aeropuerto": "Airport",
            "Puerto": "Port",
            "u Hotel": "or Hotel",
            "Canales": "Canals",
            "highlights ciudad": "city highlights",
            "Vistas desde el agua": "Views from the water"
        },
        ITA: {
            "Caminata": "Camminata",
            "Paseo a pie": "Passeggiata",
            "Bote por canales": "Barca sui canali",
            "Bote": "Barca",
            "Traslado directo": "Trasferimento diretto",
            "La Sirenita": "Sirenetta",
            "Regreso al puerto": "Ritorno al porto",
            "Vistas panorámicas principales": "Principali viste panoramiche",
            "Aeropuerto": "Aeroporto",
            "Puerto": "Porto",
            "u Hotel": "o Hotel",
            "Canales": "Canali",
            "highlights ciudad": "highlights della città",
            "Vistas desde el agua": "Viste dall'acqua"
        }
    };

    if (dict[lang]) {
        let translated = text;
        for (const [es, trans] of Object.entries(dict[lang])) {
            translated = translated.replace(new RegExp(es, 'gi'), trans);
        }
        return translated;
    }
    return text;
}

function setAppLanguage(lang) {
    currentLang = lang;
    const t = TRANSLATIONS[lang];
    
    // Update all elements with data-key
    document.querySelectorAll('.i18n').forEach(el => {
        const key = el.getAttribute('data-key');
        if (t[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = t[key];
            } else {
                el.innerHTML = t[key]; // Changed from textContent to allow <strong> in luggage_note
            }
        }
    });

    // Handle special placeholders
    const itineraryTextarea = document.getElementById('customItinerary');
    if (itineraryTextarea) itineraryTextarea.placeholder = t.itinerary_placeholder;

    // Sync Tour Language selector if needed
    const langSelect = document.getElementById('language');
    if (langSelect) {
        if (lang === 'ESP') langSelect.value = 'ESP';
        if (lang === 'ENG') langSelect.value = 'ENG';
        if (lang === 'ITA') langSelect.value = 'ITA';
    }

    // Update active flag state
    document.querySelectorAll('.lang-flag').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    updateUI();
}

// Form Elements needed for conditionals
const tourRadios = document.getElementsByName('tour');
const btnSaveTxt = btnSave.innerHTML;

function getFormData() {
    return {
        email: sessionUser.email,
        name: sessionUser.name,
        isDisembarking: document.querySelector('input[name="isDisembarking"]:checked')?.value || 'No',
        pax: parseInt(document.getElementById('pax').value) || 1,
        language: document.getElementById('language').value,
        date: document.getElementById('date').value,
        startTime: document.getElementById('startTime').value,
        tour: document.querySelector('input[name="tour"]:checked')?.value,
        customHours: parseFloat(document.getElementById('customHours').value) || 4,
        customItinerary: document.getElementById('customItinerary').value.trim(),
        needsGuide: document.querySelector('input[name="needsGuide"]:checked')?.value === 'true',
        venue1: document.getElementById('venue1').value,
        venue2: document.getElementById('venue2').value,
        venue3: document.getElementById('venue3').value
    };
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('da-DK').format(amount);
}

function updateUI() {
    const data = getFormData();
    
    // Toggle Section 2 & Info Box
    const infoBox = document.getElementById('tour-info-box');
    const customItineraryBox = document.getElementById('custom-itinerary-container');
    
    if (data.tour === 'OTHER') {
        customTourSection.classList.remove('hidden');
        customItineraryBox.classList.remove('hidden');
        infoBox.classList.add('hidden');
    } else {
        customTourSection.classList.add('hidden');
        customItineraryBox.classList.add('hidden');
        updateTourInfoBox(data.tour);
    }

    // Toggle Luggage Note
    const luggageNote = document.getElementById('luggage-note');
    if (data.isDisembarking === 'Yes') {
        luggageNote.classList.remove('hidden');
    } else {
        luggageNote.classList.add('hidden');
    }

    if (!data.date || !data.startTime || !pricingConfig) {
        // Essential data missing or prices not loaded yet
        return;
    }

    const result = calculateQuote(data, pricingConfig);

    if (result.error) {
        errorBox.textContent = result.message || 'Error calculando cotización';
        errorBox.classList.remove('hidden');
        ticketView.classList.add('hidden');
        btnCopy.disabled = true;
        btnSave.disabled = true;
        btnEmail.disabled = true;
        currentQuote = null;
        return;
    }

    // Success calculation
    errorBox.classList.add('hidden');
    ticketView.classList.remove('hidden');
    document.getElementById('save-bar').classList.remove('hidden');
    saveStatus.textContent = '';
    btnCopy.disabled = false;
    btnSave.disabled = false;
    btnEmail.disabled = false;
    currentQuote = { data, result };

    // Update Ticket Header
    tTour.textContent = result.summary.tour;
    const cleanDate = new Date(result.summary.date).toLocaleDateString('es-ES');
    tDatetime.textContent = `${cleanDate} | ${result.summary.startTime}`;
    tPax.textContent = result.summary.pax;
    tLang.textContent = result.summary.language;
    tPrice.textContent = formatCurrency(result.totalPrice);
    
    // Sub-totals calculations
    const perPerson = Math.round(result.totalPrice / result.summary.pax);
    const inEur = Math.round(result.totalPrice / DKK_TO_EUR);
    const eurPerPerson = Math.round(inEur / result.summary.pax);
    
    const t = TRANSLATIONS[currentLang];
    tPricePax.textContent = `${formatCurrency(perPerson)} DKK / ${t.total_pax}`;
    tPriceEur.textContent = `${t.approx} ${formatCurrency(inEur)} EUR (${formatCurrency(eurPerPerson)} EUR / pax)`;
    tSubtotals.classList.remove('hidden');

    // Update Breakdown
    breakdownLines.innerHTML = '';
    
    if (result.breakdown.guidePrice > 0) {
        const hGuide = result.breakdown.guideHours;
        const guideLabel = result.breakdown.guideCount > 1 
            ? `${t.guides_label} (${result.breakdown.guideCount}x ${hGuide}h)` 
            : `${t.guide_label} (${hGuide}h)`;
            
        breakdownLines.innerHTML += `
            <div class="ticket-line">
                <span class="bold">${guideLabel}:</span>
                <span class="${!isAdminMode ? 'hidden' : ''}">DKK ${formatCurrency(result.breakdown.guidePrice)}</span>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-muted); font-style: italic; margin-top: -0.5rem; margin-bottom: 0.5rem; line-height: 1.2;">
                ${t.extra_note}
            </div>`;
    }

    if (result.breakdown.busPrice > 0) {
        breakdownLines.innerHTML += `
            <div class="ticket-line">
                <span class="bold">${t.bus_label} (${result.breakdown.busCount}× ${result.breakdown.busType}):</span>
                <span class="${!isAdminMode ? 'hidden' : ''}">DKK ${formatCurrency(result.breakdown.busPrice)}</span>
            </div>`;
    }
    
    // Add Custom Itinerary to Ticket if present
    if (data.customItinerary && data.tour === 'OTHER') {
        breakdownLines.innerHTML += `
            <div style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(255, 107, 0, 0.1); border-radius: 8px; font-size: 0.85rem; border-left: 3px solid var(--primary);">
                <div style="font-weight: 600; font-size: 0.7rem; text-transform: uppercase; color: var(--primary); margin-bottom: 0.25rem;">${t.itinerary_label}</div>
                <div style="color: var(--text-main); font-style: italic; white-space: pre-wrap;">"${data.customItinerary}"</div>
            </div>`;
    }

    if (result.breakdown.venues.length > 0) {
        breakdownLines.innerHTML += `<div style="margin-top:0.75rem; color:var(--primary); font-weight:600; font-size:0.875rem;">Venues</div>`;
        result.breakdown.venues.forEach(v => {
            breakdownLines.innerHTML += `
                <div class="ticket-line">
                    <span class="bold">↳ ${v.venue} <small class="${!isAdminMode ? 'hidden' : ''}">(${result.summary.pax}×${v.pricePerPax})</small></span>
                    <span class="${!isAdminMode ? 'hidden' : ''}">DKK ${formatCurrency(v.subtotal)}</span>
                </div>`;
        });
    }
    
    // Add Subtotal and Margin (Admin only)
    if (isAdminMode) {
        breakdownLines.innerHTML += `
            <div class="ticket-line" style="margin-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 0.5rem;">
                <span class="bold">${t.net_total}:</span>
                <span>DKK ${formatCurrency(result.breakdown.netTotal)}</span>
            </div>
            <div class="ticket-line">
                <span class="bold">${t.markup} (${result.breakdown.markupPercent}%):</span>
                <span>DKK ${formatCurrency(result.breakdown.marginValue)}</span>
            </div>`;
    }
}

// ---- EVENT LISTENERS ----
form.addEventListener('input', updateUI);
form.addEventListener('change', updateUI);

// Copy Text logic (Email format)
btnCopy.addEventListener('click', () => {
    if (!currentQuote) return;
    
    const { data, result } = currentQuote;
    const d = result.summary;
    const b = result.breakdown;
    const cleanDate = new Date(d.date).toLocaleDateString(currentLang === 'ENG' ? 'en-US' : 'es-ES');
    const t = TRANSLATIONS[currentLang];

    let txt = `B2B TOUR COPENHAGEN — QUOTE\n`;
    txt += `----------------------------------\n`;
    txt += `FROM:          ${data.name} (${data.email})\n`;
    txt += `TOUR:          ${d.tour === 'OTHER' ? t.other : d.tour}\n`;
    txt += `DATE:          ${cleanDate} at ${d.startTime}\n`;
    txt += `PAX:           ${d.pax}\n`;
    txt += `LANGUAGE:      ${d.language}\n`;
    txt += `DISEMBARKING:  ${d.isDisembarking}\n\n`;

    if (data.customItinerary && d.tour === 'OTHER') {
        txt += `ITINERARY:\n"${data.customItinerary}"\n\n`;
    }

    txt += `BREAKDOWN:\n`;
    if (b.guidePrice > 0) {
        txt += `- ${b.guideCount > 1 ? t.guides_label : t.guide_label} (${b.guideHours}h)${isAdminMode ? ': DKK ' + formatCurrency(b.guidePrice) : ''}\n`;
        txt += `  (${t.extra_note})\n`;
    }
    if (b.busPrice > 0) txt += `- ${t.bus_label} (${b.busCount}× ${b.busType})${isAdminMode ? ': DKK ' + formatCurrency(b.busPrice) : ''}\n`;
    
    if (b.venues.length > 0) {
        txt += `- Venues:\n`;
        b.venues.forEach(v => {
            txt += `  * ${v.venue}${isAdminMode ? ' (' + d.pax + 'x' + v.pricePerPax + '): DKK ' + formatCurrency(v.subtotal) : ''}\n`;
        });
    }
    
    if (isAdminMode) {
        txt += `\n${t.net_total}:     DKK ${formatCurrency(b.netTotal)}\n`;
        txt += `${t.markup} (${b.markupPercent}%): DKK ${formatCurrency(b.marginValue)}\n`;
    }

    txt += `\nTOTAL: DKK ${formatCurrency(result.totalPrice)}\n`;
    
    // New: Per Pax and EUR
    const perPax = Math.round(result.totalPrice / d.pax);
    const inEur = Math.round(result.totalPrice / DKK_TO_EUR);
    const eurPerPax = Math.round(inEur / d.pax);
    
    txt += `(DKK ${formatCurrency(perPax)} ${t.total_pax})\n`;
    txt += `${t.approx} EUR: ${formatCurrency(inEur)} € (${formatCurrency(eurPerPax)} EUR / pax)\n`;
    
    navigator.clipboard.writeText(txt).then(() => {
        const icon = btnCopy.innerHTML;
        btnCopy.innerHTML = `<i class="ph ph-check"></i> Copied!`;
        btnCopy.style.background = 'rgba(16, 185, 129, 0.2)';
        btnCopy.style.color = '#10b981';
        setTimeout(() => {
            btnCopy.innerHTML = icon;
            btnCopy.style.background = '';
            btnCopy.style.color = '';
        }, 3000);
    });
});

function updateTourInfoBox(tourName) {
    const infoBox = document.getElementById('tour-info-box');
    if (!pricingConfig) return;
    
    const combinedTours = { ...TOUR_DEFAULTS, ...(pricingConfig.custom_tours || {}) };
    const info = combinedTours[tourName];
    
    if (!info) {
        infoBox.classList.add('hidden');
        return;
    }

    infoBox.classList.remove('hidden');
    
    const t = TRANSLATIONS[currentLang];
    const transport = info.transport ? translateTourText(info.transport, currentLang) : '—';
    const sights = info.sights ? translateTourText(info.sights, currentLang) : '—';
    const venues = (info.venues && info.venues.length > 0) ? info.venues.join(', ') : t.info_no_venues;

    infoBox.innerHTML = `
        <table class="tour-info-table">
            <tr>
                <td class="label">${t.info_transport}</td>
                <td class="value"><strong>${transport}</strong></td>
            </tr>
            <tr>
                <td class="label">${t.info_duration}</td>
                <td class="value"><strong>${info.hours} hs</strong></td>
            </tr>
            <tr>
                <td class="label">${t.info_sights}</td>
                <td class="value">${sights}</td>
            </tr>
            <tr>
                <td class="label">${t.info_includes}</td>
                <td class="value" style="color: var(--success); font-weight: 500;">
                    <i class="ph ph-ticket"></i> ${venues}
                </td>
            </tr>
        </table>
    `;
}

// Send Email logic (via Supabase Edge Function)
btnEmail.addEventListener('click', async () => {
    if (!currentQuote || !window.jspdf) return;

    btnEmail.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Sending...';
    btnEmail.disabled = true;

    try {
        const { data, result } = currentQuote;
        
        // 1. Generate PDF (we use the Ticket div)
        const ticketElement = document.getElementById('ticket-view');
        const saveBar = document.getElementById('save-bar');
        
        // Temporarily hide buttons for clean PDF
        saveBar.style.visibility = 'hidden';

        const canvas = await html2canvas(ticketElement, { 
            scale: 2,
            backgroundColor: '#0a0a0a' // match theme
        });
        const imgData = canvas.toDataURL('image/png');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        // Get PDF as base64 without the 'data:application/pdf;base64,' prefix
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        
        saveBar.style.visibility = 'visible';

        // 2. Call Supabase Edge Function to notify the office (info@freetourcph.com)
        const { data: functionData, error: functionError } = await supabase.functions.invoke('send-invoice', {
            body: {
                agentEmail: sessionUser.email,
                agentName: sessionUser.name,
                tourName: result.summary.tour,
                pdfBase64: pdfBase64
            }
        });

        if (functionError) throw functionError;

        saveStatus.style.color = 'var(--primary)';
        saveStatus.textContent = "Request sent to Office for verification.";
    } catch (err) {
        console.error(err);
        saveStatus.style.color = 'var(--danger)';
        saveStatus.textContent = "Error sending email. Check console.";
    } finally {
        btnEmail.innerHTML = '<i class="ph ph-envelope"></i> Email Invoice';
        btnEmail.disabled = false;
    }
});

// Save logic to Supabase
btnSave.addEventListener('click', async () => {
    if (!currentQuote) return;
    
    // Si no han configurado el Supabase Key, dar aviso de demo.
    if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
        saveStatus.style.color = 'var(--danger)';
        saveStatus.textContent = '❌ Por favor configura tus keys de Supabase en app.js';
        return;
    }

    try {
        btnSave.disabled = true;
        btnSave.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Guardando...`;
        saveStatus.textContent = '';

        const { data, result } = currentQuote;
        const d = result.summary;
        const b = result.breakdown;

        const record = {
            agent_email: data.email,
            agent_name: data.name,
            is_disembarking: d.isDisembarking === 'Yes',
            pax: d.pax,
            language: d.language,
            tour_date: d.date,
            start_time: d.startTime,
            tour_name: d.tour,
            hours: d.hours,
            guide_price: b.guidePrice,
            bus_price: b.busPrice,
            bus_type: b.busType,
            venues_total: b.venueTotal,
            total_price: result.totalPrice,
            manual_quote: false
        };

        const { error } = await supabase.from('quotes').insert([record]);

        if (error) throw error;

        saveStatus.style.color = 'var(--success)';
        saveStatus.innerHTML = '<i class="ph ph-check-circle"></i> Cotización guardada en BD.';
        setTimeout(() => saveStatus.textContent = '', 4000);

    } catch (e) {
        console.error(e);
        saveStatus.style.color = 'var(--danger)';
        saveStatus.textContent = '❌ Error al guardar: ' + e.message;
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = btnSaveTxt;
    }
});

// ---- INIT & WELCOME FLOW ----
const btnVisibility = document.getElementById('btn-visibility');
const securityModal = document.getElementById('security-modal');
const securityInput = document.getElementById('input-security-pw');
const securityConfirm = document.getElementById('btn-security-confirm');
const securityCancel = document.getElementById('btn-security-cancel');
const securityError = document.getElementById('security-error');

btnVisibility.addEventListener('click', () => {
    if (isAdminMode) {
        // Toggle back to customer view
        isAdminMode = false;
        btnVisibility.innerHTML = '<i class="ph ph-eye-slash" style="font-size: 1.5rem;"></i>';
        updateUI();
    } else {
        // Show password modal
        securityModal.classList.remove('hidden');
        securityInput.value = '';
        securityError.classList.add('hidden');
        securityInput.focus();
    }
});

securityCancel.addEventListener('click', () => {
    securityModal.classList.add('hidden');
});

function verifySecurityPassword() {
    if (securityInput.value === ADMIN_PW) {
        isAdminMode = true;
        securityModal.classList.add('hidden');
        btnVisibility.innerHTML = '<i class="ph ph-eye" style="font-size: 1.5rem;"></i>';
        updateUI();
    } else {
        securityError.classList.remove('hidden');
    }
}

securityConfirm.addEventListener('click', verifySecurityPassword);
securityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifySecurityPassword();
});

document.querySelectorAll('.lang-flag').forEach(btn => {
    btn.addEventListener('click', () => setAppLanguage(btn.getAttribute('data-lang')));
});

welcomeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sessionUser.name = document.getElementById('agentName').value;
    sessionUser.email = document.getElementById('agentEmail').value;
    
    // Transition UI
    welcomeStep.classList.add('hidden');
    calculatorWrap.classList.remove('hidden');
    quoteSidebar.classList.remove('hidden');
    
    setAppLanguage(currentLang); // Initial UI run
    updateUI();
});

// Build UI dynamically from configs
function buildDynamicUI() {
    const finalTours = { ...TOUR_DEFAULTS, ...(pricingConfig.custom_tours || {}) };
    const tourContainer = document.getElementById('tour-options-container');
    const venueSelects = document.querySelectorAll('.venue-select');
    
    // 1. Build Tours Radio Buttons
    let tourHTML = '';
    const visibleTours = Object.keys(finalTours).filter(k => !finalTours[k].deleted);
    const defaultTour = visibleTours.includes('Tivoli and Citytour') ? 'Tivoli and Citytour' : visibleTours[0];

    for (const tourName of visibleTours) {
        const info = finalTours[tourName];
        const isChecked = tourName === defaultTour ? 'checked' : '';
        const shortName = tourName.length > 18 ? tourName.substring(0, 15) + '...' : tourName;
        tourHTML += `
            <label class="radio-card">
                <input type="radio" name="tour" value="${tourName}" ${isChecked}>
                <div class="card-content">${shortName}</div>
            </label>`;
    }
    // Add OTHER always at the end
    tourHTML += `
        <label class="radio-card">
            <input type="radio" name="tour" value="OTHER">
            <div class="card-content">OTHER</div>
        </label>`;
    
    if (tourContainer) tourContainer.innerHTML = tourHTML;
    
    // 2. Build Venue Selectors
    if (!pricingConfig.venue_prices) return;
    
    let optionsHTML = `
        <option value="No Venue">No Venue</option>
        <option value="Other">Other (Manual Quote)</option>`;
        
    for (const venueName of Object.keys(pricingConfig.venue_prices)) {
        // skip secondary price mappings like Tivoli_late
        if (venueName.includes('_late')) continue; 
        optionsHTML += `<option value="${venueName}">${venueName}</option>`;
    }
    
    venueSelects.forEach(select => {
        select.innerHTML = optionsHTML;
    });
    
    // Reattach listener to dynamic radios
    const newRadios = document.getElementsByName('tour');
    newRadios.forEach(r => r.addEventListener('change', updateUI));
}

// Run once on load to init display map
async function initPricing() {
    errorBox.textContent = 'Cargando configuración desde el servidor...';
    errorBox.classList.remove('hidden');
    
    const { data, error } = await supabase.from('pricing_config').select('*').eq('id', 1).single();
    
    if (error || !data) {
        errorBox.textContent = 'No se pudieron cargar los precios (Asegúrate de haber corrido el SQL). Usando defaults provisionales...';
        // Provide an empty/fallback config if they haven't set it yet
        pricingConfig = {}; 
    } else {
        errorBox.classList.add('hidden');
        pricingConfig = data;
        buildDynamicUI();
        updateUI();
    }
}

initPricing();
