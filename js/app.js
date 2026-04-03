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

let currentQuote = null; // Store the latest calculation
let pricingConfig = null; // Store dynamic pricing from DB
let sessionUser = { name: '', email: '' }; // Store the authenticated agent from step 1

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
    
    // Toggle Section 2
    if (data.tour === 'OTHER') {
        customTourSection.classList.remove('hidden');
    } else {
        customTourSection.classList.add('hidden');
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
        currentQuote = null;
        return;
    }

    // Success calculation
    errorBox.classList.add('hidden');
    ticketView.classList.remove('hidden');
    btnCopy.disabled = false;
    btnSave.disabled = false;
    currentQuote = { data, result };

    // Update Ticket Header
    tTour.textContent = result.summary.tour;
    const cleanDate = new Date(result.summary.date).toLocaleDateString('es-ES');
    tDatetime.textContent = `${cleanDate} | ${result.summary.startTime}`;
    tPax.textContent = result.summary.pax;
    tLang.textContent = result.summary.language;
    tPrice.textContent = formatCurrency(result.totalPrice);

    // Update Breakdown
    breakdownLines.innerHTML = '';
    
    if (result.breakdown.guidePrice > 0) {
        const guideLabel = result.breakdown.guideCount > 1 
            ? `Guides (${result.breakdown.guideCount}x ${result.summary.hours}h)` 
            : `Guide (${result.summary.hours}h)`;
            
        breakdownLines.innerHTML += `
            <div class="ticket-line">
                <span class="bold">${guideLabel}:</span>
                <span>DKK ${formatCurrency(result.breakdown.guidePrice)}</span>
            </div>`;
    }

    if (result.breakdown.busPrice > 0) {
        breakdownLines.innerHTML += `
            <div class="ticket-line">
                <span class="bold">Bus (${result.breakdown.busCount}× ${result.breakdown.busType}):</span>
                <span>DKK ${formatCurrency(result.breakdown.busPrice)}</span>
            </div>`;
    }

    if (result.breakdown.venues.length > 0) {
        breakdownLines.innerHTML += `<div style="margin-top:0.75rem; color:var(--primary); font-weight:600; font-size:0.875rem;">Venues</div>`;
        result.breakdown.venues.forEach(v => {
            breakdownLines.innerHTML += `
                <div class="ticket-line">
                    <span class="bold">↳ ${v.venue} <small>(${result.summary.pax}×${v.pricePerPax})</small></span>
                    <span>DKK ${formatCurrency(v.subtotal)}</span>
                </div>`;
        });
    }
    
    // Add Subtotal and Margin
    breakdownLines.innerHTML += `
        <div class="ticket-line" style="margin-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 0.5rem;">
            <span class="bold">Net Total:</span>
            <span>DKK ${formatCurrency(result.breakdown.netTotal)}</span>
        </div>
        <div class="ticket-line">
            <span class="bold">Markup (${result.breakdown.markupPercent}%):</span>
            <span>DKK ${formatCurrency(result.breakdown.marginValue)}</span>
        </div>`;
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
    const cleanDate = new Date(d.date).toLocaleDateString('es-ES');

    let txt = `FREE TOUR COPENHAGEN — QUOTE\n`;
    txt += `----------------------------------\n`;
    txt += `FROM:          ${data.name} (${data.email})\n`;
    txt += `TOUR:          ${d.tour}\n`;
    txt += `DATE:          ${cleanDate} at ${d.startTime}\n`;
    txt += `PAX:           ${d.pax}\n`;
    txt += `LANGUAGE:      ${d.language}\n`;
    txt += `DISEMBARKING:  ${d.isDisembarking}\n\n`;

    txt += `BREAKDOWN:\n`;
    if (b.guidePrice > 0) txt += `- Guide (${d.hours}h): DKK ${formatCurrency(b.guidePrice)}\n`;
    if (b.busPrice > 0) txt += `- Bus (${b.busCount}× ${b.busType}): DKK ${formatCurrency(b.busPrice)}\n`;
    
    if (b.venues.length > 0) {
        txt += `- Venues:\n`;
        b.venues.forEach(v => {
            txt += `  * ${v.venue} (${d.pax}x${v.pricePerPax}): DKK ${formatCurrency(v.subtotal)}\n`;
        });
    }
    
    txt += `\nNet Total:     DKK ${formatCurrency(b.netTotal)}\n`;
    txt += `Markup (${b.markupPercent}%): DKK ${formatCurrency(b.marginValue)}\n`;

    txt += `\nTOTAL: DKK ${formatCurrency(result.totalPrice)}\n`;
    
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
welcomeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sessionUser.name = document.getElementById('agentName').value;
    sessionUser.email = document.getElementById('agentEmail').value;
    
    // Transition UI
    welcomeStep.classList.add('hidden');
    calculatorWrap.classList.remove('hidden');
    quoteSidebar.classList.remove('hidden');
    
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
    }
}

initPricing();
