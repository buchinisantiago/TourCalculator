// ─── TOUR CONFIGURATIONS ───────────────────────────────────────────────────────────
export const TOUR_DEFAULTS = {
  'Tivoli and Citytour':    { hours: 4,   venues: ['Tivoli'], transport: 'Bus + Caminata + Tivoli Entrance', sights: 'La Sirenita, Nyhavn, Amalienborg, Tivoli' },
  'City Highlight':         { hours: 4.5, venues: [], transport: 'Bus + Caminata', sights: 'Rådhuspladsen, Amalienborg, Canalside walk 2km, Nyhavn, Christiansborg (exterior), La Sirenita' },
  'Dragor Village':         { hours: 4,   venues: ['Coffee and Pastry'], transport: 'Bus + Paseo a pie', sights: 'La Sirenita, Dragør village walk, Coffee & Pastry' },
  'Walking Tour':           { hours: 3,   venues: [], transport: 'Bus + Caminata', sights: 'La Sirenita, Kastellet, Gefion Fountain, Amalienborg, Nyhavn, Regreso al puerto', busHours: 3 },
  'Panoramic Tour':         { hours: 3.5, venues: [], transport: 'Bus', sights: 'Vistas panorámicas principales' },
  'Private Transfers':      { hours: 1,   venues: [], transport: 'Traslado directo', sights: 'Aeropuerto ↔ Puerto u Hotel' },
  'One Day in Copenhagen':  { hours: 7,   venues: ['Canal Boat', 'Tivoli', 'Christianborg'], transport: 'Bus + Bote', sights: 'Canales, Tivoli, Christiansborg + highlights ciudad' },
  'Harbour Tour':           { hours: 3,   venues: ['Canal Boat'], transport: 'Bote por canales', sights: 'Vistas desde el agua' },
};

function getMarkupPercentage(email, config) {
   // Safe fallback values
   const mCorp = config.markup_corporate !== undefined ? config.markup_corporate : 25;
   const mPers = config.markup_personal !== undefined ? config.markup_personal : 30;

   if (!email || !email.includes('@')) return mPers;

   const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com', 'msn.com', 'freetourcph.com'];
   const domain = email.split('@')[1].toLowerCase();
   
   return personalDomains.includes(domain) ? mPers : mCorp;
}

function getGuidePrice(hours, config) {
  // Guides are paid 0.5h extra for arrival, setup and group collection
  const billableHours = hours + 0.5;
  const hr = Math.min(Math.ceil(billableHours), 10);
  return config.guide_prices[hr] || config.guide_prices[10];
}

function getBusPrice(pax, hours, config) {
  if (pax === 0) return { totalBusPrice: 0, busCount: 0, busType: 'No Bus', hr: 0 };

  const hr = Math.min(11, Math.ceil(hours));
  if (hr < 1) return { totalBusPrice: 0, busCount: 0, busType: 'No Bus', hr: 0 };
  let totalBusPrice = 0;
  let busTypesArr = [];
  let remainingPax = pax;

  // 1. Fill full 48-seater buses
  const num48 = Math.floor(remainingPax / 48);
  if (num48 > 0) {
      const price48 = config.bus_prices_48[hr] || config.bus_prices_48[11];
      totalBusPrice += (price48 * num48);
      busTypesArr.push(`${num48}x 48-seater`);
      remainingPax = remainingPax % 48;
  }

  // 2. Fit remainder in smallest possible bus
  if (remainingPax > 0) {
      let remainderBus = {};
      if (remainingPax <= 6) {
          remainderBus.type = '6-seater';
          remainderBus.price = config.bus_prices_6[hr] || config.bus_prices_6[11];
      } else if (remainingPax <= 10) {
          remainderBus.type = '10-seater';
          remainderBus.price = config.bus_prices_10[hr] || config.bus_prices_10[11];
      } else if (remainingPax <= 16) {
          remainderBus.type = '16-seater';
          remainderBus.price = config.bus_prices_16[hr] || config.bus_prices_16[11];
      } else {
          // If remainder is between 17 and 47, we need another 48-seater!
          remainderBus.type = '48-seater';
          remainderBus.price = config.bus_prices_48[hr] || config.bus_prices_48[11];
      }
      
      totalBusPrice += remainderBus.price;
      
      // Prevent silly strings like "1x 48-seater + 48-seater"
      if (remainderBus.type === '48-seater' && num48 > 0) {
          busTypesArr = [`${num48 + 1}x 48-seater`];
      } else {
          busTypesArr.push(remainderBus.type);
      }
  }

  return {
    totalBusPrice: totalBusPrice,
    busCount: num48 + (remainingPax > 0 ? 1 : 0),
    busType: busTypesArr.join(' + '),
    hr: hr
  };
}

function getVenuePrices(venues, pax, startTime, config) {
  let total = 0;
  const breakdown = [];
  
  for (const venue of venues) {
    if (!venue || venue === 'No Venue') continue;
    
    let pricePerPax = config.venue_prices[venue];
    
    if (pricePerPax === null || pricePerPax === undefined) {
      return { error: 'OTHER_VENUE', message: `Cotización manual requerida para venue personalizado (${venue}).` };
    }
    
    const subtotal = pricePerPax * pax;
    total += subtotal;
    breakdown.push({ venue, pricePerPax, subtotal });
  }
  
  return { total, breakdown };
}

export function calculateQuote(input, config) {
  if (!config) {
      return { error: 'CONFIG_MISSING', message: 'Los precios base no se han cargado desde Supabase.' };
  }

  let hours, venues, finalBusHours;
  if (input.tour === 'OTHER') {
    hours = input.customHours || 4;
    finalBusHours = hours;
    const v = [input.venue1, input.venue2, input.venue3].filter(Boolean);
    venues = v;
  } else {
    // Check custom tours first, then defaults
    const combinedTours = { ...TOUR_DEFAULTS, ...(config.custom_tours || {}) };
    const defaults = combinedTours[input.tour];
    if (!defaults) return { error: 'UNKNOWN_TOUR' };
    hours = defaults.hours;
    venues = defaults.venues || [];
    finalBusHours = defaults.busHours || hours;
  }
  
  // Custom logic for guide requirement
  let needsGuide = true;
  if (input.tour === 'Private Transfers') {
    needsGuide = false;
  } else if (input.tour === 'OTHER') {
    needsGuide = input.needsGuide !== false;
  }
  
  // 1 guide per vehicle logic
  const busInfo = getBusPrice(input.pax, finalBusHours, config);
  const baseGuidePrice = needsGuide ? getGuidePrice(hours, config) : 0;
  const guidePrice = baseGuidePrice * busInfo.busCount;
  
  const venueResult = getVenuePrices(venues, input.pax, input.startTime, config);
  if (venueResult.error) return venueResult;
  
  const netTotal = guidePrice + busInfo.totalBusPrice + venueResult.total;
  
  // Calculate Markup
  const markupPercent = getMarkupPercentage(input.email || '', config);
  const marginValue = netTotal * (markupPercent / 100);
  const totalPrice = netTotal + marginValue;
  
  return {
    success: true,
    summary: {
      tour: input.tour,
      name: input.name,
      email: input.email,
      pax: input.pax,
      date: input.date,
      startTime: input.startTime,
      language: input.language,
      hours: hours,
      isDisembarking: input.isDisembarking,
    },
    breakdown: {
      guidePrice:      guidePrice,
      busPrice: busInfo.totalBusPrice,
      busCount: busInfo.busCount,
      guideCount: needsGuide ? busInfo.busCount : 0,
      busType: busInfo.busType,
      venues: venueResult.breakdown,
      venueTotal: venueResult.total,
      netTotal: netTotal,
      markupPercent: markupPercent,
      marginValue: marginValue
    },
    totalPrice: Math.round(totalPrice), // Round to full DKK
    currency: 'DKK'
  };
}
