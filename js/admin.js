import { TOUR_DEFAULTS } from './calculator.js';

// ---- SUPABASE CONFIGURATION ----
const SUPABASE_URL = 'https://qgriwpjsslovkkmnlntg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZnEVeUYjF7ZII5An9ku5rw_1CrNo3Gl';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ---- DOM ELEMENTS ----
const loginPanel = document.getElementById('login-panel');
const dashboardPanel = document.getElementById('dashboard-panel');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogout = document.getElementById('btn-logout');

const loadingMsg = document.getElementById('loading-msg');
const editorContainer = document.getElementById('editor-container');
const matrixHeader = document.getElementById('matrix-header');
const matrixBody = document.getElementById('matrix-body');
const markupCorporate = document.getElementById('markupCorporate');
const markupPersonal = document.getElementById('markupPersonal');
const invoiceEmails = document.getElementById('invoiceEmails');
const btnSavePrices = document.getElementById('btn-save-prices');
const saveMsg = document.getElementById('save-msg');

let currentSession = null;
let currentConfig = null; // Store entire object 

// Forms & Lists
const formAddTour = document.getElementById('form-add-tour');
const formAddVenue = document.getElementById('form-add-venue');
const customToursList = document.getElementById('custom-tours-list');
const venuesList = document.getElementById('venues-list');
const newTourVenuesCheckboxes = document.getElementById('new-tour-venues-checkboxes');

// Modal Elements
const pwModal = document.getElementById('pw-modal');
const modalPwInput = document.getElementById('modal-pw-input');
const modalPwError = document.getElementById('modal-pw-error');
const modalBtnCancel = document.getElementById('modal-btn-cancel');
const modalBtnConfirm = document.getElementById('modal-btn-confirm');

let pendingDeleteTarget = null; // Store target name
let pendingDeleteType = null; // 'tour' or 'venue'

// ---- AUTH LOGIC ----
async function checkCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
        currentSession = session;
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    loginPanel.classList.remove('hidden');
    dashboardPanel.classList.add('hidden');
    btnLogout.classList.add('hidden');
}

function showDashboard() {
    loginPanel.classList.add('hidden');
    dashboardPanel.classList.remove('hidden');
    btnLogout.classList.remove('hidden');
    
    loadPrices();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Iniciando...`;
    loginError.classList.add('hidden');

    const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.value,
        password: passwordInput.value,
    });

    if (error) {
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = originalText;
    } else {
        currentSession = data.session;
        showDashboard();
    }
});

btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    currentSession = null;
    showLogin();
});

// ---- DATA FETCHING ----
async function loadPrices() {
    loadingMsg.classList.remove('hidden');
    editorContainer.classList.add('hidden');

    const { data, error } = await supabase
        .from('pricing_config')
        .select('*')
        .eq('id', 1)
        .single();

    loadingMsg.classList.add('hidden');
    editorContainer.classList.remove('hidden');

    if (error) {
        saveMsg.style.color = 'var(--danger)';
        if (error.code === 'PGRST116') {
             // No rows returned
             saveMsg.textContent = "Advertencia: No hay configuración todavía. Por favor corre el SQL en Supabase para insertar el id=1.";
             jsonPrices.value = "{\n  \"error\": \"No data found in table pricing_config\"\n}";
        } else {
             saveMsg.textContent = "Error cargando datos: " + error.message;
        }
    } else {
        saveMsg.textContent = "";
        // Extract markup and populate fields
        if (data.markup_corporate !== undefined) markupCorporate.value = data.markup_corporate;
        if (data.markup_personal !== undefined) markupPersonal.value = data.markup_personal;
        if (data.invoice_emails !== undefined) invoiceEmails.value = data.invoice_emails;
        
        // Load active offer
        if (data.active_offer) {
            const offer = data.active_offer;
            document.getElementById('offerLabel').value = offer.label || '';
            document.getElementById('offerDiscount').value = offer.discount_percent || 10;
            document.getElementById('offerValidUntil').value = offer.valid_until || '';
            const checkbox = document.getElementById('offerEnabled');
            checkbox.checked = !!offer.enabled;
            document.getElementById('offerEnabledLabel').textContent = offer.enabled ? 'Activa ✅' : 'Desactivada';
        }
        
        // Store globally for memory
        currentConfig = data;
        
        // Cleanse data to separate our states
        const { id, created_at, markup_corporate, markup_personal, custom_tours, ...pricesOnly } = data;
        
        // Render UI
        renderAllTours();
        renderVenues();
        renderMatrix();
        
        // Show sticky save bar
        const saveBar = document.getElementById('save-bar');
        if (saveBar) saveBar.classList.remove('hidden');
    }
}

// ---- MATRIX RENDERING ----
function renderMatrix() {
    // Columns header (1 to 11 hours)
    let headerHtml = '<th style="padding: 0.75rem 0.5rem;">Servicio / Horas</th>';
    for (let h = 1; h <= 11; h++) {
        headerHtml += `<th style="padding: 0.75rem 0.5rem; text-align: center;">${h}h</th>`;
    }
    matrixHeader.innerHTML = headerHtml;

    const rows = [
        { label: 'Guía', key: 'guide_prices', maxH: 10 },
        { label: 'Minivan (6)', key: 'bus_prices_6', maxH: 11 },
        { label: 'Minibus (10)', key: 'bus_prices_10', maxH: 11 },
        { label: 'Minibus (16)', key: 'bus_prices_16', maxH: 11 },
        { label: 'Bus (48)', key: 'bus_prices_48', maxH: 11 }
    ];

    let bodyHtml = '';
    rows.forEach(row => {
        bodyHtml += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 0.75rem 0.5rem; font-weight: 500; white-space: nowrap;">${row.label}</td>`;
        
        const priceMap = currentConfig[row.key] || {};
        
        for (let h = 1; h <= 11; h++) {
            // Guides only go up to 10h; buses start at 1h (pre-fill from 2h if missing)
            const isDisabled = (row.key === 'guide_prices' && h > 10);
            let val = priceMap[h] !== undefined ? priceMap[h] : '';
            
            // For buses at 1h: pre-fill with 2h value if not set
            if (row.key !== 'guide_prices' && h === 1 && val === '') {
                val = priceMap[2] !== undefined ? priceMap[2] : '';
            }
            
            if (isDisabled) {
                bodyHtml += `<td style="padding: 0.5rem; text-align: center; background: rgba(0,0,0,0.2);">—</td>`;
            } else {
                bodyHtml += `<td style="padding: 0.5rem; text-align: center;">
                    <input type="number" class="matrix-input ${row.key}" data-hour="${h}" data-key="${row.key}" value="${val}" style="width: 60px; padding: 0.25rem; font-size: 0.85rem; text-align: center;">
                </td>`;
            }
        }
        bodyHtml += `</tr>`;
    });
    matrixBody.innerHTML = bodyHtml;
}

// ---- TABLE RENDERING ----
function renderAllTours() {
    const coreToursTable = document.getElementById('core-tours-table');
    if (!coreToursTable) return;
    
    // Combine all tours
    const allToursMap = { ...TOUR_DEFAULTS };
    if (currentConfig.custom_tours) {
        for (const [key, val] of Object.entries(currentConfig.custom_tours)) {
            if (val.deleted) {
                delete allToursMap[key];
            } else {
                allToursMap[key] = {
                    hours: val.hours ?? allToursMap[key]?.hours ?? 4,
                    venues: val.venues ?? allToursMap[key]?.venues ?? [],
                    transport: val.transport ?? allToursMap[key]?.transport ?? '',
                    sights: val.sights ?? allToursMap[key]?.sights ?? '',
                    busHours: val.busHours ?? allToursMap[key]?.busHours ?? val.hours ?? 4
                };
            }
        }
    }

    let html = '';
    for (const [name, info] of Object.entries(allToursMap)) {
        const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');
        const effectiveHours = info.hours;
        const effectiveVenues = info.venues || [];
        const effectiveTransport = info.transport || '—';
        const effectiveSights = info.sights || '—';
        
        // Build venue checkboxes for edit mode
        const allVenues = Object.keys(currentConfig.venue_prices || {}).filter(v => !v.includes('_late'));
        const venueCheckboxes = allVenues.map(v => {
            const checked = effectiveVenues.includes(v) ? 'checked' : '';
            return `<label style="display:flex;align-items:center;gap:0.25rem;font-size:0.82rem;"><input type="checkbox" class="core-venue-cb" value="${v}" ${checked}> ${v}</label>`;
        }).join('');

        html += `
            <tr id="ctr-${safeId}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <!-- VIEW -->
                <td colspan="6" style="padding:0;">
                    <div id="cv-${safeId}" style="display:grid; grid-template-columns: 1.2fr 1fr 80px 2fr 1.2fr 80px; align-items:center;">
                        <span style="padding:1rem 0.5rem; font-weight:500;">${name}</span>
                        <span style="padding:1rem 0.5rem; font-size:0.85rem; color:var(--text-muted);">${effectiveTransport}</span>
                        <span style="padding:1rem 0.5rem; font-size:0.85rem;">${effectiveHours} hs</span>
                        <span style="padding:1rem 0.5rem; font-size:0.85rem; color:var(--text-muted); line-height: 1.3;">${effectiveSights}</span>
                        <span style="padding:1rem 0.5rem; color:var(--primary); font-size:0.85rem;">${effectiveVenues.length > 0 ? effectiveVenues.join(' <span style="color:var(--text-muted)">|</span> ') : '<span style="color:var(--text-muted)">—</span>'}</span>
                        <div style="padding:1rem 0.5rem; display:flex; gap:0.25rem; justify-content:flex-end;">
                            <button type="button" class="btn-edit-core-tour btn btn-secondary" data-name="${name}" style="padding:0.2rem 0.4rem; font-size:0.75rem; color:var(--primary); border-color:var(--primary);">
                                <i class="ph ph-pencil"></i>
                            </button>
                            <button type="button" class="btn-delete-core-tour btn btn-secondary" data-name="${name}" style="padding:0.2rem 0.4rem; font-size:0.75rem; border-color:var(--danger); color:var(--danger);">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </div>
                    <!-- EDIT -->
                    <div id="ce-${safeId}" class="hidden" style="padding:0.75rem; background:rgba(0,0,0,0.2); margin:0.25rem;border-radius:8px;">
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; margin-bottom:0.75rem;">
                            <div class="input-group">
                                <label style="font-size:0.8rem;">Nombre</label>
                                <input class="ce-name" type="text" value="${name}" style="padding:0.3rem;">
                            </div>
                            <div class="input-group">
                                <label style="font-size:0.8rem;">Horas Tour</label>
                                <input class="ce-hours" type="number" step="0.5" value="${info.hours}" style="padding:0.3rem;">
                            </div>
                            <div class="input-group">
                                <label style="font-size:0.8rem;">Horas Bus <small>(opcional)</small></label>
                                <input class="ce-bus-hours" type="number" step="0.5" value="${info.busHours || info.hours}" style="padding:0.3rem;">
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 2fr; gap:0.5rem; margin-bottom:0.75rem;">
                            <div class="input-group">
                                <label style="font-size:0.8rem;">Transporte</label>
                                <input class="ce-transport" type="text" value="${info.transport || ''}" placeholder="Ej: Bus + Caminata" style="padding:0.3rem;">
                            </div>
                            <div class="input-group">
                                <label style="font-size:0.8rem;">Lugares que se ven</label>
                                <input class="ce-sights" type="text" value="${info.sights || ''}" placeholder="Ej: La Sirenita, Nyhavn..." style="padding:0.3rem;">
                            </div>
                        </div>
                        <label style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.35rem; display:block;">Venues incluidos</label>
                        <div style="display:flex; flex-wrap:wrap; gap:0.5rem 1rem; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:6px; margin-bottom:0.75rem;">
                            ${venueCheckboxes || '<span style="color:var(--text-muted);font-size:0.8rem;">Sin venues</span>'}
                        </div>
                        <div style="display:flex;gap:0.5rem;">
                            <button type="button" class="btn-save-core-edit btn btn-primary" data-name="${name}" style="padding:0.3rem 0.75rem; font-size:0.85rem; flex:1;"><i class="ph ph-floppy-disk"></i> Guardar</button>
                            <button type="button" class="btn-cancel-core-edit btn btn-secondary" data-name="${name}" style="padding:0.3rem 0.75rem; font-size:0.85rem;">Cancelar</button>
                        </div>
                    </div>
                </td>
            </tr>`;
    }
    coreToursTable.innerHTML = html;

    // Attach listeners
    document.querySelectorAll('.btn-edit-core-tour').forEach(btn => {
        btn.addEventListener('click', e => {
            const safeId = e.currentTarget.getAttribute('data-name').replace(/[^a-zA-Z0-9]/g, '_');
            document.getElementById(`cv-${safeId}`).classList.add('hidden');
            document.getElementById(`ce-${safeId}`).classList.remove('hidden');
        });
    });
    
    document.querySelectorAll('.btn-cancel-core-edit').forEach(btn => {
        btn.addEventListener('click', e => {
            const safeId = e.currentTarget.getAttribute('data-name').replace(/[^a-zA-Z0-9]/g, '_');
            document.getElementById(`cv-${safeId}`).classList.remove('hidden');
            document.getElementById(`ce-${safeId}`).classList.add('hidden');
        });
    });
    
    document.querySelectorAll('.btn-save-core-edit').forEach(btn => {
        btn.addEventListener('click', e => {
            const oldName = e.currentTarget.getAttribute('data-name');
            const safeId = oldName.replace(/[^a-zA-Z0-9]/g, '_');
            const editDiv = document.getElementById(`ce-${safeId}`);
            const newName = editDiv.querySelector('.ce-name').value.trim();
            const newHours = parseFloat(editDiv.querySelector('.ce-hours').value);
            const newBusHours = parseFloat(editDiv.querySelector('.ce-bus-hours').value);
            const newTransport = editDiv.querySelector('.ce-transport').value.trim();
            const newSights = editDiv.querySelector('.ce-sights').value.trim();
            const checkedVenues = [...editDiv.querySelectorAll('.core-venue-cb:checked')].map(cb => cb.value);
            
            if (!newName || isNaN(newHours)) return;
            if (!currentConfig.custom_tours) currentConfig.custom_tours = {};
            
            // If name changed, mark old as deleted and create new
            if (newName !== oldName) {
                if (TOUR_DEFAULTS[oldName]) {
                    currentConfig.custom_tours[oldName] = { deleted: true };
                } else {
                    delete currentConfig.custom_tours[oldName];
                }
            }
            currentConfig.custom_tours[newName] = { 
                hours: newHours, 
                venues: checkedVenues,
                busHours: newBusHours,
                transport: newTransport,
                sights: newSights
            };
            
            renderAllTours();
            saveMsg.style.color = 'var(--text-muted)';
            saveMsg.textContent = `"${newName}" actualizado. Recuerda guardar en BD.`;
        });
    });
    
    document.querySelectorAll('.btn-delete-core-tour').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.currentTarget.getAttribute('data-name');
            pendingDeleteTarget = name;
            pendingDeleteType = TOUR_DEFAULTS[name] ? 'core_tour' : 'tour';
            pwModal.classList.remove('hidden');
            modalPwInput.value = '';
            modalPwError.classList.add('hidden');
            modalPwInput.focus();
        });
    });
}

function renderVenues() {
    const vp = currentConfig.venue_prices || {};
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); text-align: left;">
                    <th style="padding: 0.75rem 0.5rem;">Proveedor</th>
                    <th style="padding: 0.75rem 0.5rem;">Servicio</th>
                    <th style="padding: 0.75rem 0.5rem;">Precio</th>
                    <th style="width: 60px;"></th>
                </tr>
            </thead>
            <tbody>`;
            
    let checkboxHtml = '';
    
    for (const [vName, vPrice] of Object.entries(vp)) {
        if (vName.includes('_late')) continue;
        const safeId = vName.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Mapping logic
        let provider = vName;
        let service = 'Entrance';
        if (vName === 'Refreshment' || vName === 'Coffee and Pastry') {
            provider = 'StrandHotel';
            service = vName;
        }

        html += `
            <tr id="venue-row-${safeId}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td colspan="4" style="padding:0;">
                    <!-- VIEW MODE -->
                    <div id="venue-view-${safeId}" style="display:grid; grid-template-columns: 1fr 1fr 80px 60px; align-items:center;">
                        <span style="padding: 0.5rem;">${provider}</span>
                        <span style="padding: 0.5rem; color: var(--text-muted); font-size: 0.8rem;">${service}</span>
                        <strong style="padding: 0.5rem;">${vPrice}</strong>
                        <div style="display:flex; gap:0.2rem; justify-content:flex-end; padding: 0.5rem;">
                            <button type="button" class="btn-edit-venue btn btn-secondary" data-name="${vName}" style="padding:0.2rem 0.3rem; font-size:0.7rem; border:none; color:var(--primary);">
                                <i class="ph ph-pencil"></i>
                            </button>
                            <button type="button" class="btn-delete-venue btn btn-secondary" data-name="${vName}" style="padding:0.2rem 0.3rem; font-size:0.7rem; border:none; color:var(--text-muted);">
                                <i class="ph ph-x"></i>
                            </button>
                        </div>
                    </div>
                    <!-- EDIT MODE -->
                    <div id="venue-edit-${safeId}" class="hidden" style="padding: 0.5rem; background:rgba(0,0,0,0.2); display:flex; gap:0.5rem; align-items:center;">
                        <input class="venue-edit-price" type="number" value="${vPrice}" style="width:70px; padding:0.2rem; font-size:0.8rem;">
                        <span style="font-size:0.75rem; color:var(--text-muted);">DKK</span>
                        <button type="button" class="btn-save-venue-edit btn btn-primary" data-name="${vName}" style="padding:0.2rem 0.4rem; font-size:0.75rem;">✓</button>
                        <button type="button" class="btn-cancel-venue-edit btn btn-secondary" data-name="${vName}" style="padding:0.2rem 0.4rem; font-size:0.75rem;">✕</button>
                    </div>
                </td>
            </tr>`;
            
        checkboxHtml += `
            <label style="display:flex; align-items:center; gap:0.25rem;">
                <input type="checkbox" name="tour_venue_checkbox" value="${vName}"> ${vName}
            </label>`;
    }
    html += `</tbody></table>`;
    venuesList.innerHTML = html;
    newTourVenuesCheckboxes.innerHTML = checkboxHtml || '<span style="color:var(--text-muted); font-size:0.85rem;">No hay venues disponibles.</span>';
    
    // Edit venue listeners
    document.querySelectorAll('.btn-edit-venue').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const vName = e.currentTarget.getAttribute('data-name');
            const safeId = vName.replace(/[^a-zA-Z0-9]/g, '_');
            document.getElementById(`venue-view-${safeId}`).classList.add('hidden');
            document.getElementById(`venue-edit-${safeId}`).classList.remove('hidden');
        });
    });

    document.querySelectorAll('.btn-cancel-venue-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const vName = e.currentTarget.getAttribute('data-name');
            const safeId = vName.replace(/[^a-zA-Z0-9]/g, '_');
            document.getElementById(`venue-view-${safeId}`).classList.remove('hidden');
            document.getElementById(`venue-edit-${safeId}`).classList.add('hidden');
        });
    });

    document.querySelectorAll('.btn-save-venue-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const vName = e.currentTarget.getAttribute('data-name');
            const safeId = vName.replace(/[^a-zA-Z0-9]/g, '_');
            const row = document.getElementById(`venue-row-${safeId}`);
            const newPrice = parseFloat(row.querySelector('.venue-edit-price').value);
            if (isNaN(newPrice)) return;
            
            currentConfig.venue_prices[vName] = newPrice;
            renderVenues();
            saveMsg.style.color = 'var(--text-muted)';
            saveMsg.textContent = "Precio de venue actualizado. Recuerda guardar en BD.";
        });
    });
    
    // Delete venue listeners
    document.querySelectorAll('.btn-delete-venue').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const venueName = e.currentTarget.getAttribute('data-name');
            
            // DEPENDENCY CHECK
            const finalTours = { ...TOUR_DEFAULTS, ...(currentConfig.custom_tours || {}) };
            const usingTours = [];
            for (const [tName, info] of Object.entries(finalTours)) {
                if (info.deleted) continue;
                if (info.venues && info.venues.includes(venueName)) {
                    usingTours.push(tName);
                }
            }
            
            if (usingTours.length > 0) {
                alert(`🚫 ACCIÓN DENEGADA:\n\nNo puedes borrar el venue "${venueName}" porque actualmente está siendo utilizado en los siguientes tours:\n- ${usingTours.join('\n- ')}\n\nDebes modificar o eliminar estos tours primero antes de borrar el venue.`);
                return;
            }
            
            pendingDeleteTarget = venueName;
            pendingDeleteType = 'venue';
            pwModal.classList.remove('hidden');
            modalPwInput.value = '';
            modalPwError.classList.add('hidden');
            modalPwInput.focus();
        });
    });
}

formAddTour.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('newTourName').value.trim();
    const hours = parseFloat(document.getElementById('newTourHours').value);
    const busHoursInput = document.getElementById('newTourBusHours').value;
    const busHours = busHoursInput ? parseFloat(busHoursInput) : hours;
    const transport = document.getElementById('newTourTransport').value.trim();
    const sights = document.getElementById('newTourSights').value.trim();
    
    // Get all checked venues
    const checkedBoxes = document.querySelectorAll('input[name="tour_venue_checkbox"]:checked');
    const selectedVenues = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (!currentConfig.custom_tours) currentConfig.custom_tours = {};
    
    currentConfig.custom_tours[name] = {
        hours,
        busHours,
        transport,
        sights,
        venues: selectedVenues
    };
    
    renderAllTours();
    formAddTour.reset();
    saveMsg.style.color = 'var(--text-muted)';
    saveMsg.textContent = "Recuerda dar clic a 'Guardar Todo...' abajo.";
});

formAddVenue.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('newVenueName').value.trim();
    const price = parseInt(document.getElementById('newVenuePrice').value);
    
    if (!currentConfig.venue_prices) currentConfig.venue_prices = {};
    
    currentConfig.venue_prices[name] = price;
    
    renderVenues();
    formAddVenue.reset();
    saveMsg.style.color = 'var(--text-muted)';
    saveMsg.textContent = "Recuerda dar clic a 'Guardar Todo...' abajo.";
});

// ---- DATA SAVING ----
btnSavePrices.addEventListener('click', async () => {
    saveMsg.textContent = "Guardando...";
    saveMsg.style.color = 'var(--text-muted)';
    btnSavePrices.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Guardando...`;
    saveMsg.textContent = "";

    try {
        // Build price columns from matrix inputs
        const priceUpdate = {};
        const rowsKeys = ['guide_prices', 'bus_prices_6', 'bus_prices_10', 'bus_prices_16', 'bus_prices_48'];
        rowsKeys.forEach(k => { priceUpdate[k] = {}; });
        
        document.querySelectorAll('.matrix-input').forEach(input => {
            const val = input.value;
            if (val !== '') {
                const hour = input.getAttribute('data-hour');
                const key = input.getAttribute('data-key');
                priceUpdate[key][hour] = Number(val);
            }
        });
        
        // Add markup, venue_prices, custom_tours and active_offer
        priceUpdate.markup_corporate = Number(markupCorporate.value);
        priceUpdate.markup_personal = Number(markupPersonal.value);
        priceUpdate.invoice_emails = invoiceEmails.value.trim();
        priceUpdate.venue_prices = currentConfig.venue_prices || {};
        priceUpdate.custom_tours = currentConfig.custom_tours || {};
        priceUpdate.active_offer = {
            label: document.getElementById('offerLabel').value,
            discount_percent: Number(document.getElementById('offerDiscount').value),
            valid_until: document.getElementById('offerValidUntil').value || null,
            enabled: document.getElementById('offerEnabled').checked
        };
        
        const { error } = await supabase
            .from('pricing_config')
            .update(priceUpdate)
            .eq('id', 1);

        if (error) throw error;

        // Sync local config
        currentConfig = { ...currentConfig, ...priceUpdate };
        
        saveMsg.textContent = "✅ ¡Guardado con éxito!";
        saveMsg.style.color = 'var(--success)';
        setTimeout(() => { saveMsg.textContent = ''; }, 3000);
    } catch (e) {
        saveMsg.textContent = "Error: " + e.message;
        saveMsg.style.color = 'var(--danger)';
    } finally {
        btnSavePrices.disabled = false;
        btnSavePrices.innerHTML = `<i class="ph ph-floppy-disk"></i> Guardar Todo en Base de Datos`;
    }
});

// ---- MODAL DELETE LOGIC ----
modalBtnCancel.addEventListener('click', () => {
    pwModal.classList.add('hidden');
    pendingDeleteTarget = null;
    pendingDeleteType = null;
});

modalBtnConfirm.addEventListener('click', async () => {
    if (!pendingDeleteTarget) return;
    
    const pw = modalPwInput.value;
    if (!pw) {
        modalPwError.textContent = "Ingresa la contraseña";
        modalPwError.classList.remove('hidden');
        return;
    }
    
    modalBtnConfirm.disabled = true;
    modalBtnConfirm.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Validando...`;
    modalPwError.classList.add('hidden');
    
    // Check password
    const { data, error } = await supabase.auth.signInWithPassword({
        email: currentSession.user.email,
        password: pw,
    });
    
    modalBtnConfirm.disabled = false;
    modalBtnConfirm.innerHTML = `Eliminar`;
    
    if (error) {
        modalPwError.textContent = "Contraseña incorrecta";
        modalPwError.classList.remove('hidden');
        return;
    }
    
    // Password matched, do the deletion
    if (pendingDeleteType === 'tour') {
        delete currentConfig.custom_tours[pendingDeleteTarget];
        renderAllTours();
        saveMsg.textContent = "Tour borrado. Recuerda dar clic a 'Guardar Todo...' abajo.";
    } else if (pendingDeleteType === 'core_tour') {
        if (!currentConfig.custom_tours) currentConfig.custom_tours = {};
        currentConfig.custom_tours[pendingDeleteTarget] = { deleted: true };
        renderAllTours();
        saveMsg.textContent = "Tour Principal borrado. Recuerda dar clic a 'Guardar Todo...' abajo.";
    } else if (pendingDeleteType === 'venue') {
        delete currentConfig.venue_prices[pendingDeleteTarget];
        renderVenues();
        saveMsg.textContent = "Venue borrado. Recuerda dar clic a 'Guardar Todo...' abajo.";
    }
    
    saveMsg.style.color = 'var(--text-muted)';
    pwModal.classList.add('hidden');
    pendingDeleteTarget = null;
    pendingDeleteType = null;
});

// Run on load
checkCurrentSession();

// ---- OFFER TOGGLE LABEL ----
const offerEnabledCheckbox = document.getElementById('offerEnabled');
if (offerEnabledCheckbox) {
    offerEnabledCheckbox.addEventListener('change', () => {
        document.getElementById('offerEnabledLabel').textContent = offerEnabledCheckbox.checked ? 'Activa ✅' : 'Desactivada';
    });
}

// ---- MANUAL INVOICE ----
async function generateAndSendManualInvoice(sendEmail) {
    const client = document.getElementById('manInvClient').value || 'Unknown Client';
    const cvr = document.getElementById('manInvCvr').value;
    const address = document.getElementById('manInvAddress').value;
    const clientEmail = document.getElementById('manInvEmail').value;
    const tourDesc = document.getElementById('manInvTour').value || 'Tour Service';
    const pax = document.getElementById('manInvPax').value || 1;
    const tourDate = document.getElementById('manInvTourDate').value;
    const tourTime = document.getElementById('manInvTourTime').value;
    const amount = Number(document.getElementById('manInvAmount').value) || 0;
    const discountPct = Number(document.getElementById('manInvDiscountPct').value) || 0;
    const notes = document.getElementById('manInvNotes').value;
    const status = document.getElementById('manual-invoice-status');

    const discountAmt = Math.round(amount * discountPct / 100);
    const subTotal = amount - discountAmt;
    const tax = Math.round(subTotal * 0.25);
    const total = subTotal + tax;
    const formattedDate = tourDate ? new Date(tourDate).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : 'TBD';
    const invNo = 'CPH-M' + Date.now().toString().slice(-4);
    const now = new Date();
    const issuedDate = now.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    const due = new Date(); due.setDate(now.getDate() + 14);
    const dueDate = due.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

    // Build PDF using hidden template from index.html — or inject via jsPDF text
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();

    pdf.setFontSize(28); pdf.setFont('helvetica','bold'); pdf.text('Invoice', W - 20, 25, { align:'right' });
    pdf.setFontSize(11); pdf.setFont('helvetica','normal');
    pdf.text('Invoice No. ' + invNo, W - 20, 32, { align:'right' });
    pdf.text('Date: ' + issuedDate, W - 20, 38, { align:'right' });

    pdf.setFontSize(22); pdf.setFont('helvetica','bold'); pdf.text('Free Tour CPH', 20, 25);
    pdf.setFontSize(11); pdf.setFont('helvetica','normal');

    pdf.setFontSize(12); pdf.setFont('helvetica','bold'); pdf.text('Billed to:', W - 80, 55);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(11);
    pdf.text(client, W - 80, 62);
    if (cvr) pdf.text('CVR: ' + cvr, W - 80, 68);
    if (address) pdf.text(address, W - 80, cvr ? 74 : 68);
    if (clientEmail) pdf.text(clientEmail, W - 80, cvr ? 80 : 74);

    // Table header
    let y = 100;
    pdf.setDrawColor(0); pdf.setLineWidth(0.5);
    pdf.line(20, y, W-20, y);
    pdf.setFont('helvetica','bold'); pdf.setFontSize(11);
    pdf.text('Description', 20, y+8); pdf.text('Pax', 110, y+8); pdf.text('Price/pax', 130, y+8); pdf.text('Amount', W-20, y+8, {align:'right'});
    pdf.line(20, y+12, W-20, y+12);
    y += 20;
    pdf.setFont('helvetica','normal');
    pdf.text(tourDesc, 20, y);
    pdf.text(String(pax), 110, y);
    pdf.text('DKK ' + Math.round(amount/pax), 130, y);
    pdf.text('DKK ' + amount, W-20, y, {align:'right'});
    y += 8;
    pdf.setFontSize(10); pdf.setTextColor(100);
    pdf.text('📅 Date: ' + formattedDate + '   ⏰ ' + tourTime, 20, y);
    pdf.setTextColor(0); pdf.setFontSize(11);

    if (discountAmt > 0) {
        y += 10;
        pdf.setTextColor(180, 60, 0);
        pdf.text('Discount (' + discountPct + '% OFF)', 20, y);
        pdf.text('- DKK ' + discountAmt, W-20, y, {align:'right'});
        pdf.setTextColor(0);
    }

    // Totals
    y += 20;
    pdf.line(20, y, W-20, y); y += 10;
    pdf.text('Due Date: ' + dueDate, 20, y);
    if (notes) { y += 8; pdf.setFontSize(9); pdf.setTextColor(120); pdf.text(notes, 20, y, {maxWidth: 100}); pdf.setTextColor(0); pdf.setFontSize(11); }
    pdf.text('Sub-Total', W-60, y-8); pdf.text('DKK ' + subTotal, W-20, y-8, {align:'right'});
    pdf.text('Tax (25%)', W-60, y); pdf.text('DKK ' + tax, W-20, y, {align:'right'});
    pdf.setFont('helvetica','bold');
    pdf.text('Total', W-60, y+8); pdf.text('DKK ' + total, W-20, y+8, {align:'right'});

    const pdfBase64 = pdf.output('datauristring').split(',')[1];

    if (!sendEmail) {
        pdf.save('invoice-' + invNo + '.pdf');
        status.textContent = '✅ PDF descargado.';
        status.style.color = 'var(--success)';
        return;
    }

    status.textContent = '⏳ Enviando invoice...';
    status.style.color = 'var(--text-muted)';

    const manualSupa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const toEmails = [clientEmail, 'buchinisantiago@gmail.com'].filter(Boolean);

    const { error: fnErr } = await manualSupa.functions.invoke('super-worker', {
        body: {
            agentEmail: 'admin@freetourcph.com',
            agentName: 'Admin Manual Invoice',
            tourName: tourDesc,
            pdfBase64,
            recipients: toEmails,
            invoiceDetails: { legalName: client, cvr, address, notes }
        }
    });

    if (fnErr) {
        status.textContent = '❌ Error: ' + fnErr.message;
        status.style.color = 'var(--danger)';
    } else {
        status.textContent = '✅ Invoice enviado a ' + toEmails.join(', ');
        status.style.color = 'var(--success)';
    }
}

document.getElementById('btn-preview-manual-invoice')?.addEventListener('click', () => generateAndSendManualInvoice(false));
document.getElementById('btn-send-manual-invoice')?.addEventListener('click', () => generateAndSendManualInvoice(true));

// ---- INVOICE HISTORY ----
async function loadInvoiceHistory() {
    const tbody = document.getElementById('invoices-table-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" style="padding:1rem; color:var(--text-muted); text-align:center;"><i class="ph ph-spinner ph-spin"></i> Cargando...</td></tr>`;
    const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(50);
    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding:1.5rem; color:var(--text-muted); text-align:center;">No hay invoices registrados todavia.</td></tr>`;
        return;
    }
    const statusColors = {
        'deposit_sent': { bg: 'rgba(255,193,7,0.15)', color: '#ffc107', label: 'Deposito Enviado' },
        'final_sent':   { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Final Enviado' },
        'credit_note':  { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Nota de Credito' },
        'completed':    { bg: 'rgba(16,185,129,0.2)', color: '#10b981', label: 'Completado' },
    };
    tbody.innerHTML = data.map(inv => {
        const st = statusColors[inv.status] || { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', label: inv.status };
        const date = new Date(inv.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit' });
        const canFinal = inv.status === 'deposit_sent';
        const canCredit = inv.status !== 'credit_note';
        return `<tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding:0.6rem 0.5rem; font-family:monospace; font-size:0.8rem;">${inv.invoice_no}</td>
            <td style="padding:0.6rem 0.5rem;">${date}</td>
            <td style="padding:0.6rem 0.5rem;">${inv.client_name || '-'}</td>
            <td style="padding:0.6rem 0.5rem;">${inv.tour_name || '-'}</td>
            <td style="padding:0.6rem 0.5rem; text-align:right;">DKK ${(inv.deposit_amount||0).toLocaleString()}</td>
            <td style="padding:0.6rem 0.5rem; text-align:right;">DKK ${(inv.remaining_amount||0).toLocaleString()}</td>
            <td style="padding:0.6rem 0.5rem; text-align:center;"><span style="background:${st.bg}; color:${st.color}; padding:2px 8px; border-radius:12px; font-size:0.75rem; white-space:nowrap;">${st.label}</span></td>
            <td style="padding:0.6rem 0.5rem; text-align:center;">
                <div style="display:flex; gap:0.4rem; justify-content:center;">
                ${canFinal ? `<button class="btn-final-inv" data-id="${inv.id}" style="background:rgba(255,107,0,0.2); color:#FF6B00; border:1px solid #FF6B00; border-radius:6px; padding:3px 8px; font-size:0.75rem; cursor:pointer;"><i class="ph ph-receipt"></i> Final</button>` : ''}
                ${canCredit ? `<button class="btn-credit-note" data-id="${inv.id}" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid #ef4444; border-radius:6px; padding:3px 8px; font-size:0.75rem; cursor:pointer;"><i class="ph ph-x-circle"></i> Credito</button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('.btn-final-inv').forEach(btn => btn.addEventListener('click', () => generateFinalInvoice(Number(btn.dataset.id), data)));
    tbody.querySelectorAll('.btn-credit-note').forEach(btn => btn.addEventListener('click', () => generateCreditNote(Number(btn.dataset.id), data)));
}

async function generateFinalInvoice(invId, data) {
    const inv = data.find(i => i.id === invId);
    if (!inv) return;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    const finalInvNo = inv.invoice_no + '-FINAL';
    const now = new Date();
    const issuedDate = now.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    const due = new Date(); due.setDate(now.getDate() + 14);
    const dueDate = due.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    pdf.setFontSize(28); pdf.setFont('helvetica','bold'); pdf.text('Invoice (Final)', W-20, 25, {align:'right'});
    pdf.setFontSize(11); pdf.setFont('helvetica','normal');
    pdf.text('Invoice No. ' + finalInvNo, W-20, 32, {align:'right'});
    pdf.text('Date: ' + issuedDate, W-20, 38, {align:'right'});
    pdf.text('Ref. Deposit: ' + inv.invoice_no, W-20, 44, {align:'right'});
    pdf.setFontSize(22); pdf.setFont('helvetica','bold'); pdf.text('Free Tour CPH', 20, 25);
    pdf.setFontSize(12); pdf.setFont('helvetica','bold'); pdf.text('Billed to:', W-80, 55);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(11);
    pdf.text(inv.client_name || '', W-80, 62);
    if (inv.client_cvr) pdf.text('CVR: ' + inv.client_cvr, W-80, 68);
    let y = 100;
    pdf.setLineWidth(0.5); pdf.line(20, y, W-20, y);
    pdf.setFont('helvetica','bold'); pdf.setFontSize(11);
    pdf.text('Description', 20, y+8); pdf.text('Amount', W-20, y+8, {align:'right'});
    pdf.line(20, y+12, W-20, y+12); y += 20;
    pdf.setFont('helvetica','normal');
    pdf.text(inv.tour_name + ' - Remaining 50%', 20, y);
    pdf.text('DKK ' + (inv.remaining_amount||0), W-20, y, {align:'right'});
    y += 8; pdf.setFontSize(10); pdf.setTextColor(100);
    pdf.text('Tour: ' + (inv.tour_date||'') + '  ' + (inv.tour_time||''), 20, y);
    pdf.setTextColor(0); pdf.setFontSize(11);
    y += 20; pdf.line(20, y, W-20, y); y += 10;
    pdf.text('Due Date: ' + dueDate, 20, y);
    const remTax = Math.round((inv.remaining_amount||0) * 0.25);
    const remTotal = (inv.remaining_amount||0) + remTax;
    pdf.text('Sub-Total', W-60, y); pdf.text('DKK ' + (inv.remaining_amount||0), W-20, y, {align:'right'});
    pdf.text('Tax (25%)', W-60, y+8); pdf.text('DKK ' + remTax, W-20, y+8, {align:'right'});
    pdf.setFont('helvetica','bold');
    pdf.text('Total Due', W-60, y+16); pdf.text('DKK ' + remTotal, W-20, y+16, {align:'right'});
    pdf.save(finalInvNo + '.pdf');
    await supabase.from('invoices').update({ status: 'final_sent' }).eq('id', invId);
    await loadInvoiceHistory();
}

async function generateCreditNote(invId, data) {
    const inv = data.find(i => i.id === invId);
    if (!inv) return;
    if (!confirm('Confirmar Nota de Credito para ' + inv.invoice_no + '? Esto anula el invoice.')) return;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    const cnNo = inv.invoice_no + '-CN';
    const now = new Date();
    pdf.setFillColor(239, 68, 68); pdf.rect(0, 0, W, 18, 'F');
    pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
    pdf.text('CREDIT NOTE - This document cancels the referenced invoice', W/2, 12, {align:'center'});
    pdf.setTextColor(0);
    pdf.setFontSize(26); pdf.setFont('helvetica','bold'); pdf.text('Credit Note', W-20, 35, {align:'right'});
    pdf.setFontSize(11); pdf.setFont('helvetica','normal');
    pdf.text('Credit Note No. ' + cnNo, W-20, 42, {align:'right'});
    pdf.text('Date: ' + now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}), W-20, 48, {align:'right'});
    pdf.text('Cancels Invoice: ' + inv.invoice_no, W-20, 54, {align:'right'});
    pdf.setFontSize(22); pdf.setFont('helvetica','bold'); pdf.text('Free Tour CPH', 20, 35);
    pdf.setFontSize(12); pdf.setFont('helvetica','bold'); pdf.text('Issued to:', W-80, 68);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(11);
    pdf.text(inv.client_name || '', W-80, 75);
    let y = 100;
    pdf.line(20, y, W-20, y);
    pdf.setFont('helvetica','bold'); pdf.setFontSize(11);
    pdf.text('Description', 20, y+8); pdf.text('Amount', W-20, y+8, {align:'right'});
    pdf.line(20, y+12, W-20, y+12); y += 20;
    pdf.setFont('helvetica','normal');
    const refundAmt = inv.deposit_amount || 0;
    const refundTax = Math.round(refundAmt * 0.25);
    pdf.text(inv.tour_name + ' - Deposit Refund', 20, y);
    pdf.text('- DKK ' + refundAmt, W-20, y, {align:'right'});
    y += 20; pdf.line(20, y, W-20, y); y += 10;
    pdf.text('Sub-Total Credit', W-60, y); pdf.text('- DKK ' + refundAmt, W-20, y, {align:'right'});
    pdf.text('VAT (25%)', W-60, y+8); pdf.text('- DKK ' + refundTax, W-20, y+8, {align:'right'});
    pdf.setFont('helvetica','bold');
    pdf.text('Total Credit', W-60, y+16); pdf.text('- DKK ' + (refundAmt+refundTax), W-20, y+16, {align:'right'});
    pdf.save(cnNo + '.pdf');
    await supabase.from('invoices').update({ status: 'credit_note' }).eq('id', invId);
    await loadInvoiceHistory();
}

document.getElementById('btn-refresh-invoices')?.addEventListener('click', loadInvoiceHistory);
setTimeout(loadInvoiceHistory, 2000); // Load after auth check completes
