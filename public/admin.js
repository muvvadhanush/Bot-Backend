
const API_BASE = '/api/connections';
const connectionsList = document.getElementById('connectionsList');
const modal = document.getElementById('connectionModal');
const form = document.getElementById('connectionForm');
const toastEl = document.getElementById('toast');
const modalTitle = modal.querySelector('h2');

let isEditMode = false;
let currentEditId = null;

// --- THEME TOGGLE ---
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const iconSpan = themeToggle.querySelector('.icon');

// Icons
const SUN_ICON = '☀️';
const MOON_ICON = '🌙';

function setTheme(theme) {
    if (theme === 'light') {
        body.setAttribute('data-theme', 'light');
        iconSpan.textContent = MOON_ICON; // Show Moon to switch to dark
        localStorage.setItem('theme', 'light');
    } else {
        body.removeAttribute('data-theme'); // Default is dark
        iconSpan.textContent = SUN_ICON; // Show Sun to switch to light
        localStorage.setItem('theme', 'dark');
    }
}

// Init Theme
const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
    const isDark = !body.hasAttribute('data-theme');
    setTheme(isDark ? 'light' : 'dark');
});

// --- BEHAVIOR ENGINE ---
const salesSlider = document.getElementById('salesIntensity');
const salesVal = document.getElementById('salesVal');
const empathySlider = document.getElementById('empathyLevel');
const empathyVal = document.getElementById('empathyVal');

salesSlider.addEventListener('input', (e) => {
    salesVal.textContent = (e.target.value / 100).toFixed(1);
});

empathySlider.addEventListener('input', (e) => {
    empathyVal.textContent = (e.target.value / 100).toFixed(1);
});

// --- PAGE OVERRIDES ---
let behaviorOverrides = [];

function renderOverrides() {
    const list = document.getElementById('overridesList');
    list.innerHTML = '';
    behaviorOverrides.forEach((rule, index) => {
        const div = document.createElement('div');
        div.className = 'section-box';
        div.style.marginBottom = '10px';
        div.style.padding = '10px';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>Rule #${index + 1}</strong>
                <button type="button" class="btn text small" style="color: red;" onclick="removeOverrideRule(${index})">Remove</button>
            </div>
            <div class="form-group" style="margin-bottom: 8px;">
                <label>Match Path (e.g. /pricing)</label>
                <input type="text" value="${rule.match}" onchange="updateOverrideRule(${index}, 'match', this.value)">
            </div>
            <div class="form-group" style="margin-bottom: 8px;">
                <label>Special Instruction</label>
                <input type="text" value="${rule.instruction || ''}" onchange="updateOverrideRule(${index}, 'instruction', this.value)" placeholder="e.g. Be more aggressive">
            </div>
            <div class="form-group">
                <label>Sales Intensity Override</label>
                <input type="number" step="0.1" min="0" max="1" value="${rule.overrides?.salesIntensity || 0}" onchange="updateOverrideProp(${index}, 'salesIntensity', this.value)">
            </div>
        `;
        list.appendChild(div);
    });
}

window.removeOverrideRule = (index) => {
    behaviorOverrides.splice(index, 1);
    renderOverrides();
};

window.updateOverrideRule = (index, key, val) => {
    behaviorOverrides[index][key] = val;
};

window.updateOverrideProp = (index, key, val) => {
    if (!behaviorOverrides[index].overrides) behaviorOverrides[index].overrides = {};
    behaviorOverrides[index].overrides[key] = parseFloat(val);
};

document.getElementById('addOverrideBtn').addEventListener('click', () => {
    behaviorOverrides.push({ match: '', instruction: '', overrides: { salesIntensity: 0.8 } });
    renderOverrides();
});

// --- CONNECTIONS ---

// Load Connections
async function loadConnections() {
    try {
        const res = await fetch(`${API_BASE}/list`);
        const connections = await res.json();

        if (connections.length === 0) {
            connectionsList.innerHTML = '<div class="no-data">No connections found. Create one!</div>';
            return;
        }

        connectionsList.innerHTML = connections.map(conn => `
            <div class="card">
                <div class="card-header">
                    <div class="card-logo-box">
                        ${conn.logoUrl ? `<img src="${conn.logoUrl}" class="card-logo" alt="Logo">` : `<span class="card-icon">🤖</span>`}
                    </div>
                    <div class="card-info">
                        <div class="card-title">${conn.websiteName || 'Unnamed Website'}</div>
                        <div class="card-meta">ID: ${conn.connectionId}</div>
                    </div>
                    <span class="badge">${conn.assistantName || 'Bot'}</span>
                </div>
                <div class="card-meta">Created: ${new Date(conn.createdAt).toLocaleDateString()}</div>
                <div class="actions">
                    <button class="btn secondary" onclick="editConnection('${conn.connectionId}')">Edit</button>
                    <button class="btn text danger" onclick="deleteConnection('${conn.connectionId}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showToast('Error loading connections', true);
    }
}

// Auto Extract
document.getElementById('extractBtn').addEventListener('click', async (e) => {
    const url = document.getElementById('urlInput').value;
    const btn = e.target;

    if (!url) return showToast('Please enter a URL', true);

    const originalText = btn.textContent;
    btn.textContent = 'Extracting...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/${isEditMode ? currentEditId : 'temp'}/auto-extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await res.json();

        if (data.status === "initialized" && data.bot_identity) {
            const iden = data.bot_identity;
            document.getElementById('websiteName').value = iden.name || '';
            document.getElementById('assistantName').value = iden.name || '';
            document.getElementById('welcomeMessage').value = iden.welcomeMessage || '';
            document.getElementById('tone').value = iden.tone || '';
            document.getElementById('knowledgeBase').value = iden.summary || '';
            document.getElementById('logoUrl').value = iden.logoUrl || '';

            // Suggest ID: clean url/title to snake_case
            if (!isEditMode) {
                const base = (iden.name || 'site').toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
                document.getElementById('connectionId').value = `${base}_v1`;
            }

            showToast('Knowledge extracted successfully!');
        } else {
            showToast(data.error || 'Extraction failed', true);
        }
    } catch (err) {
        showToast('Error connecting to server', true);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// Form Submit
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    const formData = {
        connectionId: document.getElementById('connectionId').value,
        connectionSecret: document.getElementById('connectionSecret').value,
        websiteName: document.getElementById('websiteName').value,
        assistantName: document.getElementById('assistantName').value,
        welcomeMessage: document.getElementById('welcomeMessage').value,
        tone: document.getElementById('tone').value,
        knowledgeBase: document.getElementById('knowledgeBase').value,
        logoUrl: document.getElementById('logoUrl').value,
        allowedDomains: document.getElementById('allowedDomains').value.split(',').map(s => s.trim()).filter(s => s !== ''),
        behaviorProfile: {
            assistantRole: document.getElementById('assistantRole').value,
            tone: document.getElementById('behaviorTone').value,
            responseLength: document.getElementById('responseLength').value,
            salesIntensity: parseFloat(salesVal.textContent),
            empathyLevel: parseFloat(empathyVal.textContent),
            primaryGoal: document.getElementById('primaryGoal').value
        },
        behaviorOverrides: behaviorOverrides
    };

    try {
        const url = isEditMode ? `${API_BASE}/${currentEditId}` : `${API_BASE}/create`;
        const method = isEditMode ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            showToast(isEditMode ? 'Connection updated successfully!' : 'Connection saved successfully!');
            closeModal();
            loadConnections();
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to save', true);
        }
    } catch (err) {
        showToast('Error saving connection', true);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Modal Logic
document.getElementById('newConnectionBtn').addEventListener('click', () => {
    isEditMode = false;
    currentEditId = null;
    form.reset();
    behaviorOverrides = [];
    renderOverrides();
    modalTitle.textContent = 'Create New Connection';
    form.querySelector('button[type="submit"]').textContent = 'Create Connection';
    document.getElementById('connectionId').disabled = false; // Allow editing ID for new
    modal.classList.remove('hidden');
});

function closeModal() {
    modal.classList.add('hidden');
}

document.querySelector('.close-btn').addEventListener('click', closeModal);
document.querySelector('button.close-btn').addEventListener('click', closeModal); // Cancel button

function showToast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.style.backgroundColor = isError ? 'var(--danger)' : 'var(--success)';
    toastEl.classList.remove('hidden');
    setTimeout(() => toastEl.classList.add('hidden'), 3000);
}

// Edit Functionality
window.editConnection = async (id) => {
    try {
        const res = await fetch(`${API_BASE}/${id}`);
        if (!res.ok) throw new Error('Failed to fetch connection');

        const conn = await res.json();

        isEditMode = true;
        currentEditId = id;

        // Populate Form
        document.getElementById('connectionId').value = conn.connectionId;
        document.getElementById('connectionId').disabled = true; // ID cannot be changed during edit
        document.getElementById('connectionSecret').value = conn.connectionSecret || '';
        document.getElementById('websiteName').value = conn.websiteName || '';
        document.getElementById('assistantName').value = conn.assistantName || '';
        document.getElementById('welcomeMessage').value = conn.welcomeMessage || '';
        document.getElementById('tone').value = conn.tone || '';
        document.getElementById('knowledgeBase').value = conn.knowledgeBase || '';
        document.getElementById('logoUrl').value = conn.logoUrl || '';
        document.getElementById('allowedDomains').value = Array.isArray(conn.allowedDomains) ? conn.allowedDomains.join(', ') : (conn.allowedDomains || '');

        // Populate Behavior
        const profile = conn.behaviorProfile || {};
        document.getElementById('assistantRole').value = profile.assistantRole || 'support_agent';
        document.getElementById('behaviorTone').value = profile.tone || 'neutral';
        document.getElementById('responseLength').value = profile.responseLength || 'medium';
        document.getElementById('primaryGoal').value = profile.primaryGoal || 'support';
        salesSlider.value = (profile.salesIntensity || 0) * 100;
        salesVal.textContent = (profile.salesIntensity || 0).toFixed(1);
        empathySlider.value = (profile.empathyLevel || 0.5) * 100;
        empathyVal.textContent = (profile.empathyLevel || 0.5).toFixed(1);

        behaviorOverrides = conn.behaviorOverrides || [];
        renderOverrides();

        modalTitle.textContent = 'Edit Connection';
        form.querySelector('button[type="submit"]').textContent = 'Update Connection';
        modal.classList.remove('hidden');
    } catch (err) {
        showToast('Error loading connection details', true);
    }
}



// Delete Functionality
window.deleteConnection = async (id) => {
    if (!confirm(`Are you sure you want to delete connection "${id}"? This cannot be undone.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            showToast('Connection deleted successfully');
            loadConnections();
        } else if (res.status === 404) {
            // Already deleted
            showToast('Connection already deleted');
            loadConnections();
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to delete', true);
        }
    } catch (err) {
        showToast('Error deleting connection', true);
    }
}
const healthStatus = document.getElementById('healthStatus');
const healthText = healthStatus.querySelector('.status-text');

async function checkHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const res = await fetch('/health', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            healthStatus.className = 'health-status online';
            healthText.textContent = 'Backend Online';
        } else {
            throw new Error();
        }
    } catch (err) {
        healthStatus.className = 'health-status offline';
        healthText.textContent = 'Backend Offline';
    }
}

// Polling
checkHealth();
setInterval(checkHealth, 5000);

// Init
// --- TABS & MODAL LOGIC ---
const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

// Init
loadConnections();

// --- KNOWLEDGE & BRANDING HANDLERS ---

// Fetch Branding Click
document.getElementById('fetchBrandingBtn').addEventListener('click', async () => {
    if (!currentEditId) return;
    const btn = document.getElementById('fetchBrandingBtn');

    // Attempt Auto-URL from general tab if available, else ask user??
    // Actually we should assume the URL is already saved or use a prompt.
    // Simplifying: Use the URL from the 'General' tab 'urlInput' if auto-extracted, or prompt.
    // Wait, the new UI doesn't explicitly store the URL in the DB unless in websiteDescription or something.
    // Let's prompt user for URL if we don't have it, or use a workaround.
    // For now, I'll prompt user to confirm URL.

    const url = prompt("Enter website URL to fetch branding:", document.getElementById('urlInput').value || "");
    if (!url) return;

    btn.textContent = "Fetching...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/${currentEditId}/branding/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();

        if (data.success) {
            showToast("Branding updated!");
            updateBrandingUI(data.branding);
        } else {
            showToast("Branding fetch failed", true);
        }
    } catch (e) {
        showToast("Error fetching branding", true);
    } finally {
        btn.textContent = "Refetch Branding";
        btn.disabled = false;
    }
});

// Ingest Knowledge Click
document.getElementById('ingestBtn').addEventListener('click', async () => {
    if (!currentEditId) return;

    const type = document.getElementById('ingestType').value;
    const val = document.getElementById('ingestValue').value;

    if (!val) return showToast("Please enter a value", true);

    const btn = document.getElementById('ingestBtn');
    btn.textContent = "Processing...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/${currentEditId}/knowledge-ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceType: type, sourceValue: val })
        });
        const data = await res.json();

        if (data.success) {
            showToast("Knowledge ingested!");
            document.getElementById('ingestValue').value = "";
            // Refresh Knowledge Table
            reloadKnowledgeTable(currentEditId);
        } else {
            showToast("Ingestion failed", true);
        }
    } catch (e) {
        showToast("Error ingesting knowledge", true);
    } finally {
        btn.textContent = "Ingest";
        btn.disabled = false;
    }
});


// Helper: Update Branding UI
function updateBrandingUI(branding) { // expecting { faviconPath, logoPath, status }
    const favImg = document.getElementById('previewFavicon');
    const logoImg = document.getElementById('previewLogo');
    const noFav = document.getElementById('noFavicon');
    const noLogo = document.getElementById('noLogo');
    const badge = document.getElementById('brandingStatusBadge');

    badge.textContent = branding.status || 'PENDING';

    if (branding.faviconPath) {
        favImg.src = branding.faviconPath; // relative path served by public
        favImg.classList.remove('hidden');
        noFav.classList.add('hidden');
    } else {
        favImg.classList.add('hidden');
        noFav.classList.remove('hidden');
    }

    if (branding.logoPath) {
        logoImg.src = branding.logoPath;
        logoImg.classList.remove('hidden');
        noLogo.classList.add('hidden');
    } else {
        logoImg.classList.add('hidden');
        noLogo.classList.remove('hidden');
    }
}

// Helper: Reload Knowledge Table
async function reloadKnowledgeTable(id) {
    try {
        // We reuse detail endpoint
        const res = await fetch(`${API_BASE}/${id}/details`);
        const conn = await res.json();
        renderKnowledgeTable(conn.ConnectionKnowledges || []);
    } catch (e) {
        console.error(e);
    }
}

function renderKnowledgeTable(entries) {
    const tbody = document.getElementById('knowledgeTableBody');
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">No knowledge entries yet.</td></tr>';
        return;
    }

    tbody.innerHTML = entries.map(k => `
        <tr>
            <td><span class="badge">${k.sourceType}</span></td>
            <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${k.sourceType === 'URL' ? `<a href="${k.sourceValue}" target="_blank">${k.sourceValue}</a>` : k.sourceValue.substring(0, 40) + '...'}
            </td>
            <td><span class="status-dot ${k.status === 'READY' ? 'online' : 'offline'}"></span> ${k.status}</td>
            <td style="font-size:0.8rem; color:#888;">${new Date(k.createdAt).toLocaleDateString()}</td>
        </tr>
    `).join('');
}


// --- MODIFIED EDIT FUNCTION ---
window.editConnection = async (id) => {
    try {
        // Use details endpoint
        const res = await fetch(`${API_BASE}/${id}/details`);
        if (!res.ok) throw new Error('Failed to fetch connection');

        const conn = await res.json();

        isEditMode = true;
        currentEditId = id;

        // Populate Form (General Tab)
        document.getElementById('connectionId').value = conn.connectionId;
        document.getElementById('connectionId').disabled = true;
        document.getElementById('connectionSecret').value = conn.connectionSecret || '';
        document.getElementById('websiteName').value = conn.websiteName || '';
        document.getElementById('assistantName').value = conn.assistantName || '';
        document.getElementById('welcomeMessage').value = conn.welcomeMessage || '';
        document.getElementById('tone').value = conn.tone || '';
        // Removed old textarea population to avoid confusion, or keep it? 
        // Plan says remove reliance on textarea for Knowledge in Phase 11? 
        // No, keep it as legacy or clear it? The old 'knowledgeBase' field on Connection model is different from Table.
        // I will keep handling it for backward compat if user pastes text there (General Tab).
        // document.getElementById('knowledgeBase').value = conn.knowledgeBase || ''; // This field is actually missing in new HTML form above.. 
        // Wait, I replaced the form in HTML. Did I keep 'knowledgeBase'? 
        // Re-read HTML replacement... Ah, I REMOVED the textarea in the new HTML block! 
        // Good. We are moving to the Table approach.

        document.getElementById('allowedDomains').value = Array.isArray(conn.allowedDomains) ? conn.allowedDomains.join(', ') : (conn.allowedDomains || '');

        // Populate Knowledge Tab UI
        updateBrandingUI({
            faviconPath: conn.faviconPath,
            logoPath: conn.logoPath,
            status: conn.brandingStatus
        });

        renderKnowledgeTable(conn.ConnectionKnowledges || []);

        modalTitle.textContent = 'Manage Connection';
        // Reset to first tab
        tabs[0].click();

        modal.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        showToast('Error loading connection details', true);
    }
}
