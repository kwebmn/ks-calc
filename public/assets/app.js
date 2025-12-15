const state = {
  loadCountries: [],
  loadPorts: {},
  dischargeCountries: [],
  dischargePorts: {},
  cargoes: [],
};

const quantityBrackets = [
  { id: '3000', label: '3,000 mt', quantity: 3000 },
  { id: '3000-5000', label: '3,000–5,000 mt', quantity: 4000 },
  { id: '5000-10000', label: '5,000–10,000 mt', quantity: 7500 },
  { id: '25000', label: '25,000 mt', quantity: 25000 },
  { id: '50000', label: '50,000 mt', quantity: 50000 },
];

const elements = {};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

function fillSelect(selectEl, options, placeholder) {
  selectEl.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.disabled = true;
  defaultOption.selected = true;
  defaultOption.textContent = placeholder;
  selectEl.appendChild(defaultOption);

  options.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id || item;
    option.textContent = item.name || item;
    selectEl.appendChild(option);
  });
}

function showAlert(message, type = 'danger') {
  elements.alertPlaceholder.innerHTML = `
    <div class="alert alert-${type}" role="alert">${message}</div>
  `;
}

function clearAlert() {
  elements.alertPlaceholder.innerHTML = '';
}

function validateForm() {
  const loadCountry = elements.loadCountry.value;
  const loadPort = elements.loadPort.value;
  const dischargeCountry = elements.dischargeCountry.value;
  const dischargePort = elements.dischargePort.value;
  const cargo = elements.cargo.value;
  const quantityOption = elements.quantity.selectedOptions[0];
  const quantity = Number(quantityOption?.dataset.quantity ?? NaN);
  const stowage = Number(elements.stowage.value);

  const quantityValid = Number.isFinite(quantity) && quantity >= 3000 && quantity <= 50000;
  const stowageValid = Number.isFinite(stowage) && stowage > 0;

  const isValid = Boolean(loadCountry && loadPort && dischargeCountry && dischargePort && cargo) && quantityValid && stowageValid;
  elements.calculateBtn.disabled = !isValid;
  return isValid;
}

function populateLoadPorts(country) {
  const ports = state.loadPorts[country] || [];
  const sortedPorts = [...ports].sort((a, b) => a.localeCompare(b));
  fillSelect(elements.loadPort, sortedPorts, 'Select load port');
  elements.loadPort.disabled = sortedPorts.length === 0;
}

function populateDischargePorts(country) {
  const ports = state.dischargePorts[country] || [];
  const sortedPorts = [...ports].sort((a, b) => a.localeCompare(b));
  fillSelect(elements.dischargePort, sortedPorts, 'Select discharge port');
  elements.dischargePort.disabled = sortedPorts.length === 0;
}

function handleCargoChange() {
  const cargoId = elements.cargo.value;
  const cargo = state.cargoes.find((item) => item.id === cargoId);
  if (cargo) {
    elements.stowage.value = cargo.stowage_cbft_mt;
  }
  validateForm();
}

function handleLoadCountryChange() {
  const country = elements.loadCountry.value;
  if (country) {
    populateLoadPorts(country);
  } else {
    elements.loadPort.disabled = true;
  }
  validateForm();
}

function handleCountryChange() {
  const country = elements.dischargeCountry.value;
  if (country) {
    populateDischargePorts(country);
  } else {
    elements.dischargePort.disabled = true;
  }
  validateForm();
}

function resetForm() {
  elements.calcForm.reset();
  elements.loadPort.disabled = true;
  elements.dischargePort.disabled = true;
  elements.calculateBtn.disabled = true;
  elements.resultCard.classList.add('d-none');
  elements.debugInfo.textContent = '';
  clearAlert();
}

async function initData() {
  try {
    const [loadCountries, loadPorts, dischargeCountries, dischargePorts, cargoes] = await Promise.all([
      fetchJson('data/load_countries.json'),
      fetchJson('data/load_ports.json'),
      fetchJson('data/discharge_countries.json'),
      fetchJson('data/discharge_ports.json'),
      fetchJson('data/cargoes.json'),
    ]);

    state.loadCountries = loadCountries;
    state.loadPorts = loadPorts;
    state.dischargeCountries = dischargeCountries;
    state.dischargePorts = dischargePorts;
    state.cargoes = cargoes;

    fillSelect(elements.loadCountry, loadCountries, 'Select load country');
    fillSelect(elements.dischargeCountry, dischargeCountries, 'Select country');
    fillSelect(elements.cargo, cargoes, 'Select cargo');
    const quantitySelect = elements.quantity;
    quantitySelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = 'Select quantity bracket';
    quantitySelect.appendChild(placeholder);
    quantityBrackets.forEach((bracket) => {
      const option = document.createElement('option');
      option.value = bracket.id;
      option.dataset.quantity = bracket.quantity;
      option.textContent = bracket.label;
      quantitySelect.appendChild(option);
    });
  } catch (error) {
    showAlert(error.message || 'Failed to load data');
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  clearAlert();

  if (!validateForm()) {
    showAlert('Please fill all required fields correctly.');
    return;
  }

  const payload = {
    load_country: elements.loadCountry.value,
    load_port: elements.loadPort.value,
    discharge_country: elements.dischargeCountry.value,
    discharge_port: elements.dischargePort.value,
    cargo: elements.cargo.value,
    stowage_cbft_mt: Number(elements.stowage.value),
    quantity: Number(elements.quantity.selectedOptions[0]?.dataset.quantity ?? 0),
  };

  try {
    const response = await fetch('api/calc.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Calculation failed');
    }

    elements.rateValue.textContent = data.rate_usd_mt.toFixed(2);
    elements.rangeValue.textContent = `${data.rate_range.min.toFixed(2)} – ${data.rate_range.max.toFixed(2)}`;
    elements.totalValue.textContent = data.total_usd.toFixed(2);
    elements.debugInfo.textContent = `Base: ${data.base_usd_mt.toFixed(2)} | Quantity mult: ${data.q_mult.toFixed(3)} | Cargo mult: ${data.cargo_mult.toFixed(3)} | Stowage: ${data.stowage_cbft_mt}`;

    elements.resultCard.classList.remove('d-none');
  } catch (error) {
    elements.resultCard.classList.add('d-none');
    showAlert(error.message || 'Calculation failed');
  }
}

function setupEventListeners() {
  elements.dischargeCountry.addEventListener('change', handleCountryChange);
  elements.loadCountry.addEventListener('change', handleLoadCountryChange);
  elements.loadPort.addEventListener('change', validateForm);
  elements.cargo.addEventListener('change', handleCargoChange);
  elements.stowage.addEventListener('input', validateForm);
  elements.quantity.addEventListener('change', validateForm);
  elements.dischargePort.addEventListener('change', validateForm);
  elements.calcForm.addEventListener('submit', handleSubmit);
  elements.resetBtn.addEventListener('click', resetForm);
}

document.addEventListener('DOMContentLoaded', () => {
  elements.loadCountry = document.getElementById('loadCountry');
  elements.loadPort = document.getElementById('loadPort');
  elements.dischargeCountry = document.getElementById('dischargeCountry');
  elements.dischargePort = document.getElementById('dischargePort');
  elements.cargo = document.getElementById('cargo');
  elements.stowage = document.getElementById('stowage');
  elements.quantity = document.getElementById('quantity');
  elements.calculateBtn = document.getElementById('calculateBtn');
  elements.resetBtn = document.getElementById('resetBtn');
  elements.calcForm = document.getElementById('calcForm');
  elements.resultCard = document.getElementById('resultCard');
  elements.rateValue = document.getElementById('rateValue');
  elements.rangeValue = document.getElementById('rangeValue');
  elements.totalValue = document.getElementById('totalValue');
  elements.debugInfo = document.getElementById('debugInfo');
  elements.alertPlaceholder = document.getElementById('alertPlaceholder');

  setupEventListeners();
  initData();
});
