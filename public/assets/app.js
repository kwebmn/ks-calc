const state = {
  config: null,
};

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
    if (typeof item === 'string') {
      option.value = item;
      option.textContent = item;
    } else {
      option.value = item.id;
      option.textContent = item.label;
    }
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
  const loadPort = elements.loadPort.value;
  const dischargePort = elements.dischargePort.value;
  const cargo = elements.cargo.value;
  const quantityBracket = elements.quantity.value;

  const isValid = Boolean(loadPort && dischargePort && cargo && quantityBracket);
  elements.calculateBtn.disabled = !isValid;
  return isValid;
}

function resetForm() {
  elements.calcForm.reset();
  elements.resultCard.classList.add('d-none');
  elements.stowage.value = '';
  elements.durationValue.textContent = '—';
  elements.baseValue.textContent = '—';
  elements.rateValue.textContent = '—';
  elements.coefficientValue.textContent = '—';
  elements.metaInfo.textContent = '';
  clearAlert();
  validateForm();
}

function handleCargoChange() {
  const cargoName = elements.cargo.value;
  const cargo = state.config?.cargo_stowage.find((item) => item.cargo === cargoName);
  elements.stowage.value = cargo ? cargo.stowage_cbft_per_mt : '';
  validateForm();
}

function populateSelectors() {
  const { meta, load_ports: loadPorts, discharge_ports: dischargePorts, cargo_stowage: cargoes } = state.config;
  const sortedCargoes = [...cargoes].sort((a, b) => a.cargo.localeCompare(b.cargo));

  fillSelect(elements.loadPort, loadPorts, 'Select load port');
  fillSelect(elements.dischargePort, dischargePorts, 'Select discharge port');
  fillSelect(
    elements.cargo,
    sortedCargoes.map((item) => item.cargo),
    'Select cargo',
  );
  fillSelect(elements.quantity, meta.quantity_brackets, 'Select quantity bracket');

  const lastUpdate = meta.last_update ? `Updated ${meta.last_update}` : 'Update date N/A';
  elements.lastUpdate.textContent = lastUpdate;
}

async function initData() {
  try {
    const config = await fetchJson('data/freight_config.json');
    state.config = config;
    populateSelectors();
  } catch (error) {
    showAlert(error.message || 'Failed to load configuration');
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  clearAlert();

  if (!validateForm()) {
    showAlert('Please select load port, discharge port, cargo, and quantity bracket.');
    return;
  }

  const payload = {
    load_port: elements.loadPort.value,
    discharge_port: elements.dischargePort.value,
    cargo: elements.cargo.value,
    quantity_bracket: elements.quantity.value,
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

    if (data.match_level === 'ports_only') {
      showAlert(
        'Использованы ставки для выбранной пары портов (данных по грузу нет).',
        'warning',
      );
    } else if (data.match_level === 'default') {
      showAlert(
        'Использована универсальная ставка по умолчанию (маршрут отсутствует в базе).',
        'warning',
      );
    } else {
      clearAlert();
    }

    elements.resultCard.classList.remove('d-none');
    elements.rateValue.textContent = Number(data.rate_usd_mt).toFixed(1);
    elements.baseValue.textContent = Number(data.base_rate_20000_usd_mt).toFixed(1);
    elements.coefficientValue.textContent = Number(data.coefficient).toFixed(2);

    const duration = data.voyage?.duration_days;
    elements.durationValue.textContent = Number.isFinite(duration)
      ? `${duration.toFixed(1)} days`
      : 'N/A';

    const metaSummary = [
      `Currency: ${data.currency || 'USD'}`,
      `Base qty: ${data.base_quantity_mt ?? 'N/A'} mt`,
      `Speed: ${data.speed_knots ?? 'N/A'} kn`,
      `Last update: ${data.last_update ?? 'N/A'}`,
    ];
    elements.metaInfo.textContent = metaSummary.join(' | ');
  } catch (error) {
    elements.resultCard.classList.add('d-none');
    showAlert(error.message || 'Calculation failed');
  }
}

function setupEventListeners() {
  elements.loadPort.addEventListener('change', validateForm);
  elements.dischargePort.addEventListener('change', validateForm);
  elements.cargo.addEventListener('change', handleCargoChange);
  elements.quantity.addEventListener('change', validateForm);
  elements.calcForm.addEventListener('submit', handleSubmit);
  elements.resetBtn.addEventListener('click', resetForm);
}

document.addEventListener('DOMContentLoaded', () => {
  elements.loadPort = document.getElementById('loadPort');
  elements.dischargePort = document.getElementById('dischargePort');
  elements.cargo = document.getElementById('cargo');
  elements.stowage = document.getElementById('stowage');
  elements.quantity = document.getElementById('quantity');
  elements.calculateBtn = document.getElementById('calculateBtn');
  elements.resetBtn = document.getElementById('resetBtn');
  elements.calcForm = document.getElementById('calcForm');
  elements.resultCard = document.getElementById('resultCard');
  elements.rateValue = document.getElementById('rateValue');
  elements.baseValue = document.getElementById('baseValue');
  elements.coefficientValue = document.getElementById('coefficientValue');
  elements.durationValue = document.getElementById('durationValue');
  elements.metaInfo = document.getElementById('metaInfo');
  elements.alertPlaceholder = document.getElementById('alertPlaceholder');
  elements.lastUpdate = document.getElementById('lastUpdate');

  setupEventListeners();
  initData();
});
