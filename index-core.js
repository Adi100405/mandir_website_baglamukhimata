var modalService = '';
var SERVICE_CARD_DETAILS = {};
var SERVICE_CARD_VISUALS = {
  "karmakand|श्री बंगलामुखी हवन|0": "media/services/cards/karmakand_shri_banglamukhi_hawan.jpg",
  "karmakand|Mirchi Hawan|1": "media/services/cards/karmakand_mirchi_hawan.jpg",
  "karmakand|नज़र बाधा निवारण|2": "media/services/cards/karmakand_nazar_badha_nivaran.jpg",
  "karmakand|तन्त्र बाधा निवारण|3": "media/services/cards/karmakand_tantra_badha_nivaran.jpg",
  "karmakand|शत्रु बाधा|4": "media/services/cards/protection_ritual.jpg",
  "karmakand|मुकदमा / कोर्ट केस|5": "media/services/cards/legal_victory.jpg",
  "karmakand|बिजनेस कार्य सिद्धि|6": "media/services/cards/business_prosperity.jpg",
  "karmakand|लक्ष्मी प्राप्ति-हवन तीन दिवसीय तीन ब्राह्मणों द्वारा|7": "media/services/cards/karmakand_lakshmi_prapti_hawan.jpg",
  "karmakand|चण्डी हवन विधानम्|8": "media/services/cards/karmakand_chandi_hawan_vidhanam.jpg",
  "karmakand|प्रेत बाधा निवारण|9": "media/services/cards/karmakand_pret_badha_nivaran.jpg",
  "puja|सत्यनारायण व्रत कथा|10": "media/services/cards/puja_satyanarayan_vrat_katha.jpg",
  "puja|गृहप्रवेश पूजा|11": "media/services/cards/puja_grihpravesh_puja.jpg",
  "puja|नामकरण संस्कार|12": "media/services/cards/puja_namkaran_sanskar.jpg",
  "puja|गृह शांति हवन|13": "media/services/cards/puja_grih_shanti_hawan.jpg",
  "puja|जन्मदिवस पूजा हवन|14": "media/services/cards/puja_janmdivas_puja_hawan.jpg",
  "puja|सुन्दरकाण्ड पाठ संगीतमय|15": "media/services/cards/puja_sundarkand_path_sangeetmay.jpg",
  "puja|नवग्रह शान्ति हवन|16": "media/services/cards/puja_navgrah_shanti_hawan.jpg",
  "puja|नवग्रह जाप नव ब्राह्मणों द्वारा तीन दिवसीय|17": "media/services/cards/puja_navgrah_jaap_three_day.jpg",
  "puja|चण्डी हवन विधानम्|18": "media/services/cards/puja_chandi_hawan_vidhanam.jpg",
  "jaap|महामृत्युंजय जप सात ब्राह्मणों द्वारा पाँच दिवसीय|19": "media/services/cards/jaap_mahamrityunjay_jaap.jpg",
  "jaap|सुन्दरकाण्ड पाठ|20": "media/services/cards/jaap_sundarkand_path.jpg",
  "jaap|बंगलामुखी जप सात ब्राह्मणों द्वारा सात दिवसीय|21": "media/services/cards/jaap_banglamukhi_jaap.jpg",
  "jaap|गौ दान गौशाला|22": "media/services/cards/jaap_gau_daan_gaushala.jpg",
  "jaap|दुर्गा सप्त शती पाठ|23": "media/services/cards/jaap_durga_sapt_shati_path.jpg",
  "abhishek|रुद्राभिषेक|24": "media/services/cards/abhishek_rudrabhishek.jpg",
  "abhishek|गरुण पुराण सात दिवसीय|25": "media/services/cards/abhishek_garun_puran_seven_day.jpg",
  "abhishek|तेरहवीं संस्कार|26": "media/services/cards/abhishek_terahvi_sanskar.jpg"
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
  var serviceVisuals = typeof SERVICE_VISUALS !== 'undefined' && SERVICE_VISUALS ? SERVICE_VISUALS : {};
  var matchedKey = findMatchingKey(serviceVisuals, service);
  return matchedKey ? serviceVisuals[matchedKey] : 'media/services/sacred_path.jpg';
}

function getEstimatedPriceLabel(service) {
  if (normalizeServiceName(service) === normalizeServiceName(MIRCHI_HAWAN_SERVICE)) {
    return '₹500 / person';
  }
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
  if (normalizeServiceName(service) === normalizeServiceName(MIRCHI_HAWAN_SERVICE)) {
    return 'This is a samuhik hawan with a fixed slot from 15 July 2026 to 29 July 2026, 8 PM – 9 PM. Final participant count is confirmed during booking.';
  }
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

  document.addEventListener('DOMContentLoaded', function() {
    var modal = document.getElementById('modal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === this) closeModal();
      });
    }
    enhanceServiceCards();
    var today = new Date().toISOString().split('T')[0];
    document.getElementById('f-date').min = today;

    document.getElementById('f-loc').addEventListener('change', toggleAddressField);
    document.getElementById('f-service').addEventListener('change', applyServiceLocationRules);
    document.getElementById('f-date').addEventListener('change', updateAvailableTimeSlots);
    document.getElementById('f-time').addEventListener('change', validateSelectedTimeSlot);
    document.getElementById('f-participants').addEventListener('input', calculateBookingPrice);
    document.getElementById('f-participants').addEventListener('change', calculateBookingPrice);

    var phoneInput = document.getElementById('f-phone');
    var whatsappInput = document.getElementById('f-whatsapp');
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
    setInterval(updateAvailableTimeSlots, 60000);
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

  const MIRCHI_HAWAN_SERVICE = "Mirchi Hawan";
  const MIRCHI_HAWAN_RATE = 500;
  const MIRCHI_HAWAN_START = "2026-07-15";
  const MIRCHI_HAWAN_END = "2026-07-29";
  const MIRCHI_HAWAN_TIME = "8 PM – 9 PM";

  function isMirchiHawanService(service) {
    return normalizeServiceName(service) === normalizeServiceName(MIRCHI_HAWAN_SERVICE);
  }

  function getMirchiParticipantCount() {
    var input = document.getElementById('f-participants');
    var count = Number(input && input.value ? input.value : 1);
    if (!Number.isFinite(count) || count < 1) count = 1;
    return Math.floor(count);
  }

  function buildBookingNote(note, service) {
    if (!isMirchiHawanService(service)) return note;
    var participants = getMirchiParticipantCount();
    var extra = 'Samuhik Hawan | Participants: ' + participants + ' | Rate: ₹500 per person | Slot: 8 PM – 9 PM';
    return note ? note + ' | ' + extra : extra;
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

  function updateMirchiHawanFields() {
    var service = document.getElementById('f-service').value;
    var participantsGroup = document.getElementById('mirchi-participants-group');
    var participantsInput = document.getElementById('f-participants');
    var dateInput = document.getElementById('f-date');
    var timeSelect = document.getElementById('f-time');
    var fixedTimeOption = timeSelect ? timeSelect.querySelector('option[data-special="mirchi-hawan"]') : null;
    var today = new Date().toISOString().split('T')[0];
    var isMirchi = isMirchiHawanService(service);

    if (participantsGroup) {
      participantsGroup.style.display = isMirchi ? '' : 'none';
    }
    if (participantsInput) {
      participantsInput.required = isMirchi;
      if (!isMirchi || !participantsInput.value || Number(participantsInput.value) < 1) {
        participantsInput.value = '1';
      }
    }
    if (dateInput) {
      dateInput.min = isMirchi ? MIRCHI_HAWAN_START : today;
      dateInput.max = isMirchi ? MIRCHI_HAWAN_END : '';
      if (isMirchi && dateInput.value && (dateInput.value < MIRCHI_HAWAN_START || dateInput.value > MIRCHI_HAWAN_END)) {
        dateInput.value = '';
      }
    }
    if (timeSelect) {
      for (var i = 0; i < timeSelect.options.length; i++) {
        var option = timeSelect.options[i];
        if (!option.value) continue;
        var isSpecial = option.getAttribute('data-special') === 'mirchi-hawan';
        if (isMirchi) {
          option.hidden = !isSpecial;
          option.disabled = !isSpecial;
          option.textContent = option.value;
        } else {
          option.hidden = isSpecial;
          option.disabled = isSpecial;
          option.textContent = option.value;
        }
      }
      if (fixedTimeOption) {
        fixedTimeOption.hidden = !isMirchi;
        fixedTimeOption.disabled = !isMirchi;
      }
      if (isMirchi) {
        timeSelect.value = MIRCHI_HAWAN_TIME;
      } else if (timeSelect.value === MIRCHI_HAWAN_TIME) {
        timeSelect.value = '';
      }
    }

    updateAvailableTimeSlots();
    calculateBookingPrice();
  }

  function updateAvailableTimeSlots() {
    var service = document.getElementById('f-service').value;
    var dateInput = document.getElementById('f-date');
    var timeSelect = document.getElementById('f-time');
    var timeHelp = document.getElementById('time-help');
    var fixedTimeOption = timeSelect ? timeSelect.querySelector('option[data-special="mirchi-hawan"]') : null;
    if (!dateInput || !timeSelect) return true;

    var selectedDate = parseLocalDateInput(dateInput.value);
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (selectedDate && selectedDate < todayStart) {
      dateInput.value = '';
      selectedDate = null;
    }

    if (isMirchiHawanService(service)) {
      var isValidWindow = !!dateInput.value && dateInput.value >= MIRCHI_HAWAN_START && dateInput.value <= MIRCHI_HAWAN_END;
      var isTodayMirchi = selectedDate && isSameLocalDate(selectedDate, now);
      var mirchiClosedForToday = isTodayMirchi && now.getHours() >= 21;

      for (var m = 0; m < timeSelect.options.length; m++) {
        var specialOption = timeSelect.options[m];
        if (!specialOption.value) continue;
        var isSpecialOption = specialOption.getAttribute('data-special') === 'mirchi-hawan';
        specialOption.hidden = !isSpecialOption;
        specialOption.textContent = specialOption.value;
        specialOption.disabled = !isSpecialOption || !isValidWindow || mirchiClosedForToday;
      }

      if (fixedTimeOption && !fixedTimeOption.disabled) {
        timeSelect.value = MIRCHI_HAWAN_TIME;
      } else if (timeSelect.value === MIRCHI_HAWAN_TIME) {
        timeSelect.value = '';
      }

      if (timeHelp) {
        if (!selectedDate) {
          timeHelp.textContent = 'Mirchi Hawan is available only from 15-07-2026 to 29-07-2026, with a fixed slot of 8 PM – 9 PM.';
        } else if (!isValidWindow) {
          timeHelp.textContent = 'Please choose a date between 15-07-2026 and 29-07-2026 for Mirchi Hawan.';
        } else if (mirchiClosedForToday) {
          timeHelp.textContent = 'Today’s Mirchi Hawan slot has already closed. Please choose the next available date.';
        } else {
          timeHelp.textContent = 'Mirchi Hawan has a fixed daily slot of 8 PM – 9 PM.';
        }
      }

      return isValidWindow && !mirchiClosedForToday;
    }

    var isToday = selectedDate && isSameLocalDate(selectedDate, now);
    var availableCount = 0;

    for (var i = 0; i < timeSelect.options.length; i++) {
      var option = timeSelect.options[i];
      if (!option.value) continue;

      var isSpecialRegular = option.getAttribute('data-special') === 'mirchi-hawan';
      if (isSpecialRegular) {
        option.hidden = true;
        option.disabled = true;
        option.textContent = option.value;
        continue;
      }

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

    const SERVICE_PRICES = {
    "श्री बंगलामुखी हवन": 3100,
    "Mirchi Hawan": 500,
    "नज़र बाधा निवारण": 3100,
    "तन्त्र बाधा निवारण": 5100,
    "शत्रु बाधा": 5100,
    "मुकदमा / कोर्ट केस": 3100,
    "बिजनेस कार्य सिद्धि": 2100,
    "लक्ष्मी प्राप्ति-हवन तीन दिवसीय तीन ब्राह्मणों द्वारा": 21000,
    "चण्डी हवन विधानम्": 5100,
    "प्रेत बाधा निवारण": 2100,
    "सत्यनारायण व्रत कथा": 5100,
    "गृहप्रवेश पूजा": 5100,
    "नामकरण संस्कार": 5100,
    "गृह शांति हवन": 3100,
    "जन्मदिवस पूजा हवन": 5100,
    "सुन्दरकाण्ड पाठ संगीतमय": 8100,
    "नवग्रह शान्ति हवन": 5100,
    "नवग्रह जाप नव ब्राह्मणों द्वारा तीन दिवसीय": 31000,
    "महामृत्युंजय जप सात ब्राह्मणों द्वारा पाँच दिवसीय": 80000,
    "सुन्दरकाण्ड पाठ": 5100,
    "बंगलामुखी जप सात ब्राह्मणों द्वारा सात दिवसीय": 115000,
    "गौ दान गौशाला": 1100,
    "दुर्गा सप्त शती पाठ — 9 पाठ": 21000,
    "रुद्राभिषेक": 5100,
    "गरुण पुराण सात दिवसीय": 11000,
    "तेरहवीं संस्कार": 11000
};
  const TRAVEL_CHARGES = {
    "At the Temple": 0,
    "At My Home": 700,
    "Other Location": 1000
  };

  const SERVICE_LOCATION_RULES = {
    "श्री बंगलामुखी हवन": ["At the Temple"],
    "Mirchi Hawan": ["At the Temple"],
    "नज़र बाधा निवारण": ["At the Temple"],
    "तन्त्र बाधा निवारण": ["At the Temple"],
    "शत्रु बाधा": ["At the Temple"],
    "मुकदमा / कोर्ट केस": ["At the Temple"],
    "बिजनेस कार्य सिद्धि": ["At the Temple"],
    "लक्ष्मी प्राप्ति-हवन तीन दिवसीय तीन ब्राह्मणों द्वारा": ["At the Temple"],
    "प्रेत बाधा निवारण": ["At the Temple"],

    "सत्यनारायण व्रत कथा": ["At My Home", "Other Location"],
    "गृहप्रवेश पूजा": ["At My Home", "Other Location"],
    "नामकरण संस्कार": ["At My Home", "Other Location"],
    "गृह शांति हवन": ["At My Home", "Other Location"],
    "जन्मदिवस पूजा हवन": ["At My Home", "Other Location"],
    "सुन्दरकाण्ड पाठ संगीतमय": ["At My Home", "Other Location"],
    "नवग्रह शान्ति हवन": ["At My Home", "Other Location"],
    "नवग्रह जाप नव ब्राह्मणों द्वारा तीन दिवसीय": ["At the Temple"],
    "चण्डी हवन विधानम्": ["At the Temple", "At My Home", "Other Location"],
    "महामृत्युंजय जप सात ब्राह्मणों द्वारा पाँच दिवसीय": ["At the Temple"],
    "सुन्दरकाण्ड पाठ": ["At My Home", "Other Location"],
    "बंगलामुखी जप सात ब्राह्मणों द्वारा सात दिवसीय": ["At the Temple"],
    "गौ दान गौशाला": ["At the Temple"],
    "दुर्गा सप्त शती पाठ — 9 पाठ": ["At the Temple", "At My Home", "Other Location"],
    "रुद्राभिषेक": ["At the Temple", "At My Home", "Other Location"],
    "गरुण पुराण सात दिवसीय": ["At My Home", "Other Location"],
    "तेरहवीं संस्कार": ["At My Home", "Other Location"]
  };

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
    updateMirchiHawanFields();
  }

  function formatCurrency(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN");
  }

  function calculateBookingPrice() {
    var service = document.getElementById('f-service').value;
    var location = document.getElementById('f-loc').value;
    var allowedLocations = getAllowedLocationsForService(service);
    var safeLocation = allowedLocations.indexOf(location) !== -1 ? location : (allowedLocations[0] || "At the Temple");
    var isMirchi = isMirchiHawanService(service);
    var participants = getMirchiParticipantCount();
    var baseCost = isMirchi ? participants * MIRCHI_HAWAN_RATE : (SERVICE_PRICES[service] || 0);
    var travelCost = isMirchi ? 0 : (TRAVEL_CHARGES[safeLocation] || 0);
    var totalCost = baseCost + travelCost;

    document.getElementById('ritual-cost').textContent = formatCurrency(baseCost);
    document.getElementById('travel-cost').textContent = formatCurrency(travelCost);
    document.getElementById('total-price').textContent = formatCurrency(totalCost);

    return { baseCost, travelCost, totalCost, participants };
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
    var isMirchi = isMirchiHawanService(service);
    var participants = getMirchiParticipantCount();
    var gotraToSend = gotra;
    var timeToSend = isMirchi ? MIRCHI_HAWAN_TIME : time;
    var locationToSend = isMirchi ? 'At the Temple' : location;
    var finalNote = buildBookingNote(note, service);
    var submitBtn = document.querySelector('.form-submit');

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

    if (isMirchi && participants < 1) {
      alert("Please enter a valid number of participants for Mirchi Hawan.");
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
        participants: participants,
        note: finalNote
      });

      showToast('Booking request submitted for ' + service + '! Estimated service charge ' + formatCurrency(pricing.totalCost) + '. We will confirm on ' + phone + '. Jay Mata Di!');

      document.getElementById('f-name').value = '';
      document.getElementById('f-phone').value = '';
      document.getElementById('f-whatsapp').value = '';
      document.getElementById('f-whatsapp').dataset.autoFill = 'auto';
      document.getElementById('f-service').value = '';
      document.getElementById('f-gotra').value = '';
      document.getElementById('f-participants').value = '1';
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
