window.BOOKING_CONFIG = window.BOOKING_CONFIG || {};
window.BOOKING_CONFIG_READY =
  window.BOOKING_CONFIG_READY ||
  fetch('booking-config.json?v=20260725b', { cache: 'no-cache' })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Failed to load booking configuration.');
      }
      return response.json();
    })
    .then(function(config) {
      window.BOOKING_CONFIG = config || {};
      return window.BOOKING_CONFIG;
    })
    .catch(function() {
      window.BOOKING_CONFIG = window.BOOKING_CONFIG || {};
      return window.BOOKING_CONFIG;
    });

var BOOKING = {};
var SERVICE_PRICES = {};
var TRAVEL_CHARGES = {};
var SERVICE_LOCATION_RULES = {};

function applyBookingConfig(config) {
  BOOKING = config || {};
  SERVICE_PRICES = BOOKING.servicePrices || {};
  TRAVEL_CHARGES = BOOKING.travelCharges || {};
  SERVICE_LOCATION_RULES = BOOKING.serviceLocationRules || {};
}

applyBookingConfig(window.BOOKING_CONFIG);

var modalService = '';
var SERVICE_CARD_DETAILS = {};
var bookingUiInitialized = false;
var timeSlotRefreshTimer = null;
var SERVICE_CARD_VISUALS = {
  "karmakand|श्री बंगलामुखी हवन|0": "media/services/cards/karmakand_shri_banglamukhi_hawan.jpg",
  "karmakand|नज़र बाधा निवारण|1": "media/services/cards/karmakand_nazar_badha_nivaran.jpg",
  "karmakand|तन्त्र बाधा निवारण|2": "media/services/cards/karmakand_tantra_badha_nivaran.jpg",
  "karmakand|शत्रु बाधा|3": "media/services/cards/protection_ritual.jpg",
  "karmakand|मुकदमा / कोर्ट केस|4": "media/services/cards/legal_victory.jpg",
  "karmakand|बिजनेस कार्य सिद्धि|5": "media/services/cards/business_prosperity.jpg",
  "karmakand|लक्ष्मी प्राप्ति-हवन तीन दिवसीय तीन ब्राह्मणों द्वारा|6": "media/services/cards/karmakand_lakshmi_prapti_hawan.jpg",
  "karmakand|चण्डी हवन विधानम्|7": "media/services/cards/karmakand_chandi_hawan_vidhanam.jpg",
  "karmakand|प्रेत बाधा निवारण|8": "media/services/cards/karmakand_pret_badha_nivaran.jpg",
  "puja|सत्यनारायण व्रत कथा|9": "media/services/cards/puja_satyanarayan_vrat_katha.jpg",
  "puja|गृहप्रवेश पूजा|10": "media/services/cards/puja_grihpravesh_puja.jpg",
  "puja|नामकरण संस्कार|11": "media/services/cards/puja_namkaran_sanskar.jpg",
  "puja|गृह शांति हवन|12": "media/services/cards/puja_grih_shanti_hawan.jpg",
  "puja|जन्मदिवस पूजा हवन|13": "media/services/cards/puja_janmdivas_puja_hawan.jpg",
  "puja|सुन्दरकाण्ड पाठ संगीतमय|14": "media/services/cards/puja_sundarkand_path_sangeetmay.jpg",
  "puja|नवग्रह शान्ति हवन|15": "media/services/cards/puja_navgrah_shanti_hawan.jpg",
  "puja|नवग्रह जाप नव ब्राह्मणों द्वारा तीन दिवसीय|16": "media/services/cards/puja_navgrah_jaap_three_day.jpg",
  "puja|चण्डी हवन विधानम्|17": "media/services/cards/puja_chandi_hawan_vidhanam.jpg",
  "jaap|महामृत्युंजय जप सात ब्राह्मणों द्वारा पाँच दिवसीय|18": "media/services/cards/jaap_mahamrityunjay_jaap.jpg",
  "jaap|सुन्दरकाण्ड पाठ|19": "media/services/cards/jaap_sundarkand_path.jpg",
  "jaap|बंगलामुखी जप सात ब्राह्मणों द्वारा सात दिवसीय|20": "media/services/cards/jaap_banglamukhi_jaap.jpg",
  "jaap|गौ दान गौशाला|21": "media/services/cards/jaap_gau_daan_gaushala.jpg",
  "jaap|दुर्गा सप्त शती पाठ|22": "media/services/cards/jaap_durga_sapt_shati_path.jpg",
  "abhishek|रुद्राभिषेक|23": "media/services/cards/abhishek_rudrabhishek.jpg",
  "abhishek|गरुण पुराण सात दिवसीय|24": "media/services/cards/abhishek_garun_puran_seven_day.jpg",
  "abhishek|तेरहवीं संस्कार|25": "media/services/cards/abhishek_terahvi_sanskar.jpg"
};

function normalizeServiceName(value) {
  return String(value || '')
    .replace(/—/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findMatchingKey(source, service) {
  var requested = normalizeServiceName(service);
  if (!requested) return '';

  for (var key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    var normalizedKey = normalizeServiceName(key);
    if (
      normalizedKey === requested ||
      normalizedKey.indexOf(requested) !== -1 ||
      requested.indexOf(normalizedKey) !== -1
    ) {
      return key;
    }
  }

  return '';
}

function extractServiceFromCard(card, fallbackTitle) {
  var inlineHandler = card.getAttribute('onclick') || '';
  var match = inlineHandler.match(/openBooking\('([\s\S]*?)'\)/);
  return match && match[1] ? match[1] : fallbackTitle;
}

function buildServiceCardKey(service, category, index) {
  return String(category || '') + '|' + String(service || '') + '|' + String(index || 0);
}

function getServiceAmount(service) {
  var matchedKey = findMatchingKey(SERVICE_PRICES, service);
  return matchedKey ? Number(SERVICE_PRICES[matchedKey] || 0) : 0;
}

function getServiceVisualFor(service, category, index) {
  var cardKey = buildServiceCardKey(service, category, index);
  if (SERVICE_CARD_VISUALS[cardKey]) {
    return SERVICE_CARD_VISUALS[cardKey];
  }
  var shortName = normalizeServiceName(String(service || '').split(/[-–—]/)[0]);
  if (shortName) {
    for (var key in SERVICE_CARD_VISUALS) {
      if (!Object.prototype.hasOwnProperty.call(SERVICE_CARD_VISUALS, key)) continue;
      var keyParts = key.split('|');
      if (category && keyParts[0] !== category) continue;
      var keyName = normalizeServiceName(keyParts[1] || '');
      if (keyName && (keyName === shortName || keyName.indexOf(shortName) !== -1 || shortName.indexOf(keyName) !== -1)) {
        return SERVICE_CARD_VISUALS[key];
      }
    }
  }
  var serviceVisuals = typeof SERVICE_VISUALS !== 'undefined' && SERVICE_VISUALS ? SERVICE_VISUALS : {};
  var matchedKey = findMatchingKey(serviceVisuals, service);
  return matchedKey ? serviceVisuals[matchedKey] : 'media/site/shri_baglamukhi_mata.jpg';
}

function getEstimatedPriceLabel(service) {
  var amount = getServiceAmount(service);
  return amount ? formatCurrency(amount) : 'Custom pricing';
}

function getLocationAvailabilityLabel(allowedLocations) {
  if (!allowedLocations || !allowedLocations.length) return 'Temple / Home';
  if (allowedLocations.length === 1 && allowedLocations[0] === 'At the Temple') {
    return 'Temple only';
  }
  if (allowedLocations.length === 2 && allowedLocations.indexOf('At the Temple') === -1) {
    return 'Home / Other location';
  }
  return 'Temple / Home / Other';
}

function getServiceModalNote(service) {
  return 'The temple team confirms final scheduling, samagri requirements, and exact seva coordination after your booking request is submitted.';
}

function createServiceActionButton(label, className, onClick) {
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'service-action-btn ' + className;
  button.textContent = label;
  button.addEventListener('click', function(event) {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function openServiceLearn(detailKey, service) {
  var modal = document.getElementById('modal');
  if (!modal) return;

  var details = SERVICE_CARD_DETAILS[detailKey] || SERVICE_CARD_DETAILS[normalizeServiceName(service)];
  if (!details) {
    var allowedLocations = getAllowedLocationsForService(service);
    details = {
      title: service,
      description: 'Learn more about this ritual and proceed to booking when you are ready.',
      image: getServiceVisualFor(service),
      price: getEstimatedPriceLabel(service),
      location: getLocationHelpText(service, allowedLocations),
      note: getServiceModalNote(service)
    };
  }

  document.getElementById('modal-title').textContent = details.title;
  document.getElementById('modal-image').src = details.image;
  document.getElementById('modal-image').alt = details.title;
  document.getElementById('modal-description').textContent = details.description;
  document.getElementById('modal-price').textContent = details.price;
  document.getElementById('modal-location').textContent = details.location;
  document.getElementById('modal-note').textContent = details.note;

  var bookBtn = document.getElementById('modal-book-btn');
  if (bookBtn) {
    bookBtn.onclick = function() {
      closeModal();
      openBooking(service);
    };
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function enhanceServiceCards() {
  var grid = document.getElementById('services-grid');
  if (!grid) return;

  var cards = grid.querySelectorAll('.service-card');
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var nameEl = card.querySelector('.service-name');
    var descEl = card.querySelector('.service-desc');
    if (!nameEl || !descEl) continue;

    var title = nameEl.textContent.trim();
    var service = extractServiceFromCard(card, title);
    var category = card.getAttribute('data-cat') || '';
    var description = descEl.textContent.trim();
    var allowedLocations = getAllowedLocationsForService(service);
    var detailKey = buildServiceCardKey(service, category, i);
    var visual = getServiceVisualFor(service, category, i);

    SERVICE_CARD_DETAILS[detailKey] = {
      title: title,
      description: description,
      image: visual,
      price: getEstimatedPriceLabel(service),
      location: getLocationHelpText(service, allowedLocations),
      note: getServiceModalNote(service)
    };
    SERVICE_CARD_DETAILS[normalizeServiceName(service)] = SERVICE_CARD_DETAILS[detailKey];

    card.removeAttribute('onclick');
    card.style.cursor = 'default';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', title);
    card.innerHTML = '';

    var media = document.createElement('div');
    media.className = 'service-card-media';

    var img = document.createElement('img');
    img.src = visual;
    img.alt = title;
    img.loading = 'lazy';
    media.appendChild(img);

    var body = document.createElement('div');
    body.className = 'service-card-body';

    var serviceName = document.createElement('div');
    serviceName.className = 'service-name';
    serviceName.textContent = title;

    var serviceDesc = document.createElement('div');
    serviceDesc.className = 'service-desc';
    serviceDesc.textContent = description;

    var meta = document.createElement('div');
    meta.className = 'service-meta';

    var price = document.createElement('span');
    price.className = 'service-price';
    price.textContent = getEstimatedPriceLabel(service);

    var location = document.createElement('span');
    location.className = 'service-location-pill';
    location.textContent = getLocationAvailabilityLabel(allowedLocations);

    meta.appendChild(price);
    meta.appendChild(location);

    var actions = document.createElement('div');
    actions.className = 'service-actions';
    actions.appendChild(createServiceActionButton('Book', 'service-book-btn', (function(selectedService) {
      return function() {
        openBooking(selectedService);
      };
    })(service)));
    actions.appendChild(createServiceActionButton('Learn', 'service-learn-btn', (function(selectedService) {
      var selectedDetailKey = detailKey;
      return function() {
        openServiceLearn(selectedDetailKey, selectedService);
      };
    })(service)));

    body.appendChild(serviceName);
    body.appendChild(serviceDesc);
    body.appendChild(meta);
    body.appendChild(actions);

    card.appendChild(media);
    card.appendChild(body);
  }
}

  function selectServiceAndScroll(service) {
    var serviceSelect = document.getElementById('f-service');
    if (!serviceSelect) return;

  var normalizedRequested = normalizeServiceName(service);
    var matchedValue = '';

    for (var i = 0; i < serviceSelect.options.length; i++) {
      var option = serviceSelect.options[i];
    var normalizedOption = normalizeServiceName(option.text);

      if (
        normalizedOption === normalizedRequested ||
        normalizedOption.indexOf(normalizedRequested) !== -1 ||
        normalizedRequested.indexOf(normalizedOption) !== -1
      ) {
        matchedValue = option.value || option.text;
        break;
      }
    }

    if (!matchedValue) {
      matchedValue = service;
    }

    serviceSelect.value = matchedValue;

    if (typeof applyServiceLocationRules === 'function') {
      applyServiceLocationRules();
    }

    var bookingSection = document.getElementById('booking');
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function openBooking(service) {
    modalService = service;
    selectServiceAndScroll(service);
  }

    function closeModal() {
    var modal = document.getElementById('modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

async function initializeBookingUi() {
  if (bookingUiInitialized) return;
  bookingUiInitialized = true;

  var modal = document.getElementById('modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });
  }
  enhanceServiceCards();

  var dateInput = document.getElementById('f-date');
  var locationSelect = document.getElementById('f-loc');
  var serviceSelect = document.getElementById('f-service');
  var timeSelect = document.getElementById('f-time');
  var phoneInput = document.getElementById('f-phone');
  var whatsappInput = document.getElementById('f-whatsapp');

  if (dateInput) {
    dateInput.min = new Date().toISOString().split('T')[0];
    dateInput.addEventListener('change', updateAvailableTimeSlots);
  }

  if (locationSelect) {
    locationSelect.addEventListener('change', toggleAddressField);
  }

  if (serviceSelect) {
    serviceSelect.addEventListener('change', applyServiceLocationRules);
  }

  if (timeSelect) {
    timeSelect.addEventListener('change', validateSelectedTimeSlot);
  }

  if (phoneInput && whatsappInput) {
    phoneInput.addEventListener('input', syncPreferredWhatsappNumber);
    whatsappInput.addEventListener('input', handlePreferredWhatsappInput);
    whatsappInput.addEventListener('blur', ensurePreferredWhatsappNumber);
    syncPreferredWhatsappNumber();
  }

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') closeModal();
  });

  applyServiceLocationRules();
  updateAvailableTimeSlots();

  if (!timeSlotRefreshTimer) {
    timeSlotRefreshTimer = window.setInterval(updateAvailableTimeSlots, 60000);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  window.BOOKING_CONFIG_READY
    .then(function(config) {
      applyBookingConfig(config);
    })
    .finally(function() {
      initializeBookingUi();
    });
});


  function parseLocalDateInput(value) {
    if (!value) return null;
    var parts = value.split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isSameLocalDate(a, b) {
    return a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function buildBookingNote(note, service) {
    return note;
  }

  function isValidEmailAddress(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  function isValidPhoneNumber(value) {
    return String(value || '').replace(/\D/g, '').length >= 10;
  }

  function getPreferredWhatsappNumber() {
    var phoneInput = document.getElementById('f-phone');
    var whatsappInput = document.getElementById('f-whatsapp');
    var phone = phoneInput ? phoneInput.value.trim() : '';
    var whatsapp = whatsappInput ? whatsappInput.value.trim() : '';
    return whatsapp || phone;
  }

  function syncPreferredWhatsappNumber() {
    var phoneInput = document.getElementById('f-phone');
    var whatsappInput = document.getElementById('f-whatsapp');
    if (!phoneInput || !whatsappInput) return;
    var phone = phoneInput.value.trim();
    var whatsapp = whatsappInput.value.trim();
    var autoFill = whatsappInput.dataset.autoFill !== 'manual';
    if (!whatsapp || autoFill) {
      whatsappInput.value = phone;
      whatsappInput.dataset.autoFill = 'auto';
    }
  }

  function handlePreferredWhatsappInput() {
    var phoneInput = document.getElementById('f-phone');
    var whatsappInput = document.getElementById('f-whatsapp');
    if (!whatsappInput) return;
    var phone = phoneInput ? phoneInput.value.trim() : '';
    var whatsapp = whatsappInput.value.trim();
    whatsappInput.dataset.autoFill = !whatsapp || whatsapp === phone ? 'auto' : 'manual';
  }

  function ensurePreferredWhatsappNumber() {
    var phoneInput = document.getElementById('f-phone');
    var whatsappInput = document.getElementById('f-whatsapp');
    if (!whatsappInput) return '';
    var resolved = getPreferredWhatsappNumber();
    whatsappInput.value = resolved;
    whatsappInput.dataset.autoFill =
      resolved && phoneInput && resolved === phoneInput.value.trim() ? 'auto' : 'manual';
    return resolved;
  }

  function updateAvailableTimeSlots() {
    var dateInput = document.getElementById('f-date');
    var timeSelect = document.getElementById('f-time');
    var timeHelp = document.getElementById('time-help');
    if (!dateInput || !timeSelect) return true;

    var selectedDate = parseLocalDateInput(dateInput.value);
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (selectedDate && selectedDate < todayStart) {
      dateInput.value = '';
      selectedDate = null;
    }

    var isToday = selectedDate && isSameLocalDate(selectedDate, now);
    var availableCount = 0;

    for (var i = 0; i < timeSelect.options.length; i++) {
      var option = timeSelect.options[i];
      if (!option.value) continue;

      option.hidden = false;
      var endHour = Number(option.getAttribute('data-end-hour') || 0);
      var shouldDisable = isToday && endHour <= now.getHours();

      option.disabled = shouldDisable;
      option.textContent = option.value + (shouldDisable ? ' — Not available now' : '');

      if (!shouldDisable) availableCount++;
    }

    if (timeSelect.selectedOptions[0] && timeSelect.selectedOptions[0].disabled) {
      timeSelect.value = '';
    }

    if (timeHelp) {
      if (!selectedDate) {
        timeHelp.textContent = 'Select a date first. Past time slots are disabled automatically for today.';
      } else if (isToday && availableCount === 0) {
        timeHelp.textContent = 'No time slots are available for today. Please select the next available date.';
      } else if (isToday) {
        timeHelp.textContent = 'Past time slots for today are disabled automatically.';
      } else {
        timeHelp.textContent = 'All regular time slots are available for the selected future date.';
      }
    }

    return !isToday || availableCount > 0;
  }

  function validateSelectedTimeSlot() {
    var timeSelect = document.getElementById('f-time');
    if (!timeSelect) return true;
    updateAvailableTimeSlots();
    if (!timeSelect.value) return false;
    var selected = timeSelect.selectedOptions[0];
    return selected && !selected.disabled;
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 4000);
  }

  function getAllowedLocationsForService(service) {
    var matchedKey = findMatchingKey(SERVICE_LOCATION_RULES, service);
    return matchedKey ? SERVICE_LOCATION_RULES[matchedKey] : ["At the Temple", "At My Home", "Other Location"];
  }

  function getLocationHelpText(service, allowedLocations) {
    if (!service) {
      return "Some rituals are only available at the temple, while others can be performed at your home or another venue.";
    }
    if (allowedLocations.length === 1 && allowedLocations[0] === "At the Temple") {
      return "This ritual is performed only at the temple.";
    }
    if (allowedLocations.length === 2 && allowedLocations.indexOf("At the Temple") === -1) {
      return "This ritual is performed at your home or another location. Temple booking is not available for this ritual.";
    }
    return "This ritual can be performed at the temple, at your home, or at another approved location.";
  }

  function applyServiceLocationRules() {
    var service = document.getElementById('f-service').value;
    var locationSelect = document.getElementById('f-loc');
    var help = document.getElementById('location-help');
    var allowedLocations = getAllowedLocationsForService(service);
    var firstAllowed = allowedLocations[0] || "At the Temple";

    for (var i = 0; i < locationSelect.options.length; i++) {
      var option = locationSelect.options[i];
      var allowed = allowedLocations.indexOf(option.value || option.text) !== -1;
      option.disabled = !allowed;
    }

    if (allowedLocations.indexOf(locationSelect.value) === -1) {
      locationSelect.value = firstAllowed;
    }

    if (help) {
      help.textContent = getLocationHelpText(service, allowedLocations);
    }

    toggleAddressField();
    updateAvailableTimeSlots();
    calculateBookingPrice();
  }

  function formatCurrency(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN");
  }

  function calculateBookingPrice() {
    var service = document.getElementById('f-service').value;
    var location = document.getElementById('f-loc').value;
    var allowedLocations = getAllowedLocationsForService(service);
    var safeLocation = allowedLocations.indexOf(location) !== -1 ? location : (allowedLocations[0] || "At the Temple");
    var baseCost = (SERVICE_PRICES[service] || 0);
    var travelCost = (TRAVEL_CHARGES[safeLocation] || 0);
    var totalCost = baseCost + travelCost;

    document.getElementById('ritual-cost').textContent = formatCurrency(baseCost);
    document.getElementById('travel-cost').textContent = formatCurrency(travelCost);
    document.getElementById('total-price').textContent = formatCurrency(totalCost);

    return { baseCost, travelCost, totalCost, participants: 1 };
  }

  function toggleAddressField() {
    var location = document.getElementById('f-loc').value;
    var group = document.getElementById('address-group');
    var address = document.getElementById('f-address');

    if (location === 'At My Home' || location === 'Other Location') {
      group.style.display = 'flex';
      address.setAttribute('required', 'required');
    } else {
      group.style.display = 'none';
      address.removeAttribute('required');
      address.value = '';
    }

    calculateBookingPrice();
  }

  async function submitBooking() {
    var name = document.getElementById('f-name').value.trim();
    var phone = document.getElementById('f-phone').value.trim();
    var service = document.getElementById('f-service').value;
    var gotra = document.getElementById('f-gotra').value.trim();
    var date = document.getElementById('f-date').value;
    var time = document.getElementById('f-time').value;
    var location = document.getElementById('f-loc').value;
    var address = document.getElementById('f-address').value.trim();
    var whatsapp = ensurePreferredWhatsappNumber();
    var email = document.getElementById('f-email').value.trim();
    var note = document.getElementById('f-note').value.trim();
    var pricing = calculateBookingPrice();
    var gotraToSend = gotra;
    var timeToSend = time;
    var locationToSend = location;
    var finalNote = buildBookingNote(note, service);
    var submitBtn = document.getElementById('booking-pay-btn');

    if (!name || !phone || !whatsapp || !service || !date || !timeToSend) {
      alert("Please fill all required fields, including preferred WhatsApp number and preferred time slot.");
      return;
    }

    if (!isValidPhoneNumber(phone)) {
      alert("Please enter a valid mobile number.");
      return;
    }

    if (!isValidPhoneNumber(whatsapp)) {
      alert("Please enter a valid preferred WhatsApp number.");
      return;
    }

    if (email && !isValidEmailAddress(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (!validateSelectedTimeSlot()) {
      alert("Please select an available time slot.");
      return;
    }

    var allowedLocations = getAllowedLocationsForService(service);
    if (allowedLocations.indexOf(locationToSend) === -1) {
      alert("Please select a valid location for this ritual.");
      applyServiceLocationRules();
      return;
    }

    if ((locationToSend === 'At My Home' || locationToSend === 'Other Location') && !address) {
      alert("Please enter the full address for the पूजा location.");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      await payNow(service, {
        purpose: "booking",
        name: name,
        phone: phone,
        preferredWhatsapp: whatsapp,
        service: service,
        gotra: gotraToSend,
        date: date,
        time: timeToSend,
        location: locationToSend,
        address: address,
        email: email,
        participants: 1,
        note: finalNote
      });

      showToast('Booking request submitted for ' + service + '! Estimated service charge ' + formatCurrency(pricing.totalCost) + '. We will confirm on ' + phone + '. Jay Mata Di!');

      document.getElementById('f-name').value = '';
      document.getElementById('f-phone').value = '';
      document.getElementById('f-whatsapp').value = '';
      document.getElementById('f-whatsapp').dataset.autoFill = 'auto';
      document.getElementById('f-service').value = '';
      document.getElementById('f-gotra').value = '';
      document.getElementById('f-date').value = '';
      document.getElementById('f-time').selectedIndex = 0;
      document.getElementById('f-loc').selectedIndex = 0;
      document.getElementById('f-email').value = '';
      document.getElementById('f-note').value = '';
      document.getElementById('f-address').value = '';
      applyServiceLocationRules();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Booking failed. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '🙏 Submit Booking Request';
    }
  }

  function filterServices(btn, cat) {

    var tabs = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.remove('active');
    }
    btn.classList.add('active');
    var cards = document.getElementById('services-grid').querySelectorAll('.service-card');
    for (var j = 0; j < cards.length; j++) {
      var cardCat = cards[j].getAttribute('data-cat');
      if (cat === 'all' || cardCat === cat) {
        cards[j].style.display = '';
      } else {
        cards[j].style.display = 'none';
      }
    }
  }
