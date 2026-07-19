(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  let selectedId = null;
  let driversCache = [];

  function showLogin() {
    $('#login-view').classList.remove('hidden');
    $('#app-view').classList.add('hidden');
  }

  function showApp() {
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    const user = API.getUser('partner');
    if (user) {
      $('#side-company').textContent = user.company_name || user.company || 'Partner';
      $('#side-plan').textContent = (user.plan || 'pilot') + ' plan';
      $('#side-email').textContent = user.email || '';
      if (user.api_key) $('#api-key').value = user.api_key;
    }
  }

  async function bootstrap() {
    if (!API.getToken('partner')) {
      showLogin();
      return;
    }
    try {
      const me = await API.request('/api/auth/partner/me');
      API.setSession('partner', API.getToken('partner'), me.partner);
      showApp();
      await refreshAll();
    } catch {
      API.clearSession('partner');
      showLogin();
    }
  }

  async function refreshAll() {
    await Promise.all([loadStats(), loadOrders(), loadDrivers()]);
    if (selectedId) await showDetail(selectedId);
  }

  async function loadStats() {
    const s = await API.partnerStats();
    $('#s-open').textContent = s.open_orders;
    $('#s-total').textContent = s.total_orders;
    $('#s-volume').textContent = money(s.total_volume);
    $('#s-paid').textContent = s.paid_today.count;
    $('#s-paid-vol').textContent = money(s.paid_today.volume) + ' volume';
    $('#s-cycle').textContent = s.avg_cycle_hours != null ? s.avg_cycle_hours + 'h' : '—';
  }

  async function loadOrders() {
    const status = $('#status-filter').value;
    const q = $('#q').value.trim();
    const params = {};
    if (status) params.status = status;
    if (q) params.q = q;
    const { orders, total } = await API.partnerOrders(params);
    $('#order-count').textContent = total + ' order' + (total === 1 ? '' : 's');
    const body = $('#orders-body');
    body.innerHTML = '';
    if (!orders.length) {
      $('#orders-empty').classList.remove('hidden');
      return;
    }
    $('#orders-empty').classList.add('hidden');
    for (const o of orders) {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      if (o.id === selectedId) tr.style.background = 'var(--brand-soft)';
      tr.innerHTML = `
        <td>
          <div class="mono">${o.external_ref || o.id.slice(0, 8)}</div>
          <strong>${escapeHtml(o.device_brand)} ${escapeHtml(o.device_model)}</strong>
          <div class="muted">${escapeHtml(o.device_storage || '')} · ${escapeHtml(o.device_condition)}</div>
        </td>
        <td>
          ${escapeHtml(o.seller_name)}
          <div class="muted">${escapeHtml(o.pickup_city)}</div>
        </td>
        <td class="amount">${money(o.quoted_amount)}</td>
        <td>${statusChip(o.status)}</td>
        <td class="muted">${escapeHtml(o.driver_name || '—')}</td>
        <td><button class="btn btn-ghost btn-sm" type="button" data-open="${o.id}">View</button></td>
      `;
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        showDetail(o.id);
      });
      tr.querySelector('[data-open]').addEventListener('click', () => showDetail(o.id));
      body.appendChild(tr);
    }
  }

  async function showDetail(id) {
    selectedId = id;
    const { order, events } = await API.partnerOrder(id);
    $('#detail-status').innerHTML = statusChip(order.status);
    const specs = order.expected_specs || {};
    const verified = order.verified_specs || {};
    const actions = [];
    if (order.status === 'verified' && !order.paid) {
      actions.push(`<button class="btn btn-accent btn-sm" type="button" id="act-pay">Release same-day pay</button>`);
    }
    if (['pending', 'assigned'].includes(order.status)) {
      actions.push(`<button class="btn btn-soft btn-sm" type="button" id="act-assign">Assign driver</button>`);
    }
    if (!['paid', 'cancelled'].includes(order.status)) {
      actions.push(`<button class="btn btn-ghost btn-sm" type="button" id="act-cancel">Cancel</button>`);
    }

    $('#detail-body').innerHTML = `
      <div class="stack">
        <div class="row between">
          <div>
            <strong>${escapeHtml(order.device_brand)} ${escapeHtml(order.device_model)}</strong>
            <div class="text-sm text-muted mono">${escapeHtml(order.external_ref || order.id)}</div>
          </div>
          <div class="amount">${money(order.quoted_amount)}</div>
        </div>
        <div class="text-sm">
          <div><strong>Seller:</strong> ${escapeHtml(order.seller_name)} · ${escapeHtml(order.seller_phone)}</div>
          <div><strong>Pickup:</strong> ${escapeHtml(order.pickup_address)}, ${escapeHtml(order.pickup_city)} ${escapeHtml(order.pickup_zip)}</div>
          <div><strong>Driver:</strong> ${escapeHtml(order.driver_name || 'Unassigned')} ${order.driver_roadie_id ? '(' + escapeHtml(order.driver_roadie_id) + ')' : ''}</div>
          <div><strong>IMEI:</strong> <span class="mono">${escapeHtml(order.imei || '—')}</span></div>
          <div><strong>Packed:</strong> ${order.packed ? 'Yes' : 'No'} · <strong>Paid:</strong> ${order.paid ? 'Yes @ ' + fmtWhen(order.paid_at) : 'No'}</div>
        </div>
        <div>
          <div class="text-sm"><strong>Expected specs</strong></div>
          <pre class="mono text-sm" style="margin:.25rem 0 0;white-space:pre-wrap;background:var(--canvas);padding:.5rem;border-radius:6px">${escapeHtml(JSON.stringify(specs, null, 2))}</pre>
        </div>
        ${
          order.verified_specs
            ? `<div>
                <div class="text-sm"><strong>Verification</strong> ${
                  order.verification_match ? statusChip('verified') : statusChip('mismatch')
                }</div>
                <pre class="mono text-sm" style="margin:.25rem 0 0;white-space:pre-wrap;background:var(--canvas);padding:.5rem;border-radius:6px">${escapeHtml(JSON.stringify(verified, null, 2))}</pre>
                ${order.verification_notes ? `<p class="text-sm mt-1">${escapeHtml(order.verification_notes)}</p>` : ''}
              </div>`
            : ''
        }
        <div class="row">${actions.join('')}</div>
        <div>
          <div class="text-sm mb-1"><strong>Event log</strong></div>
          <div class="timeline">
            ${(events || [])
              .map(
                (ev) => `
              <div class="ev">
                <div class="dot"></div>
                <div>
                  <strong>${escapeHtml(ev.event)}</strong>
                  <span>${fmtWhen(ev.created_at)} · ${escapeHtml(ev.actor_type || 'system')}</span>
                </div>
              </div>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    const payBtn = $('#act-pay');
    if (payBtn) {
      payBtn.addEventListener('click', async () => {
        if (!confirm('Release same-day payment to seller?')) return;
        try {
          await API.payOrder(order.id);
          await refreshAll();
        } catch (err) {
          alert(err.message);
        }
      });
    }
    const cancelBtn = $('#act-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        const reason = prompt('Cancel reason?', 'Cancelled by partner') || 'Cancelled by partner';
        try {
          await API.cancelOrder(order.id, reason);
          await refreshAll();
        } catch (err) {
          alert(err.message);
        }
      });
    }
    const assignBtn = $('#act-assign');
    if (assignBtn) {
      assignBtn.addEventListener('click', () => openAssign(order.id));
    }

    // re-highlight table
    loadOrders().catch(() => {});
  }

  async function loadDrivers() {
    const { drivers } = await API.partnerDrivers();
    driversCache = drivers;
    const body = $('#drivers-body');
    body.innerHTML = drivers
      .map(
        (d) => `
      <tr>
        <td><strong>${escapeHtml(d.name)}</strong><div class="muted">${escapeHtml(d.phone || '')}</div></td>
        <td>${(d.zones || []).map((z) => `<span class="chip">${escapeHtml(z)}</span>`).join(' ')}</td>
        <td>${escapeHtml(d.vehicle || '—')}</td>
        <td class="mono">${escapeHtml(d.roadie_id || '—')}</td>
        <td>${d.rating}</td>
        <td>${statusChip(d.status)}</td>
      </tr>`
      )
      .join('');
  }

  function openAssign(orderId) {
    $('#assign-order-id').value = orderId;
    const sel = $('#assign-driver');
    sel.innerHTML = driversCache
      .map((d) => `<option value="${d.id}">${escapeHtml(d.name)} · ${escapeHtml(d.status)} · ${(d.zones || []).join(', ')}</option>`)
      .join('');
    $('#assign-modal').classList.add('open');
  }

  function setView(name) {
    $$('.side-nav a[data-view]').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
    $('#view-orders').classList.toggle('hidden', name !== 'orders');
    $('#view-create').classList.toggle('hidden', name !== 'create');
    $('#view-drivers').classList.toggle('hidden', name !== 'drivers');
    $('#view-api').classList.toggle('hidden', name !== 'api');
    const titles = {
      orders: 'Purchased devices',
      create: 'New pickup',
      drivers: 'Driver network',
      api: 'API access',
    };
    $('#view-title').textContent = titles[name] || 'Dashboard';
    if (name === 'drivers') loadDrivers();
    if (name === 'api') {
      const u = API.getUser('partner');
      if (u && u.api_key) $('#api-key').value = u.api_key;
    }
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // events
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const alert = $('#login-alert');
    try {
      const res = await API.partnerLogin(fd.get('email'), fd.get('password'));
      API.setSession('partner', res.token, res.partner);
      showApp();
      await refreshAll();
    } catch (err) {
      alert.className = 'alert alert-error';
      alert.textContent = err.message;
      alert.classList.remove('hidden');
    }
  });

  $('#btn-logout').addEventListener('click', () => {
    API.clearSession('partner');
    showLogin();
  });

  $$('.side-nav a[data-view]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setView(a.dataset.view);
    });
  });

  $('#btn-new-pickup').addEventListener('click', () => setView('create'));
  $('#btn-refresh').addEventListener('click', () => refreshAll());
  $('#btn-filter').addEventListener('click', () => loadOrders());
  $('#q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadOrders();
  });

  $('#create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.quoted_amount = Number(body.quoted_amount);
    body.expected_specs = {
      brand: body.device_brand,
      model: body.device_model,
      storage: body.device_storage,
      color: body.device_color,
      condition: body.device_condition,
      powers_on: true,
      screen_cracks: body.device_condition === 'Poor',
      account_locked: false,
    };
    const alert = $('#create-alert');
    try {
      const { order } = await API.createOrder(body);
      alert.className = 'alert alert-ok';
      alert.textContent = 'Order created: ' + (order.external_ref || order.id);
      alert.classList.remove('hidden');
      e.target.reset();
      setView('orders');
      selectedId = order.id;
      await refreshAll();
    } catch (err) {
      alert.className = 'alert alert-error';
      alert.textContent = err.message;
      alert.classList.remove('hidden');
    }
  });

  $('#btn-copy-key').addEventListener('click', async () => {
    const v = $('#api-key').value;
    if (!v) return;
    await navigator.clipboard.writeText(v);
    $('#btn-copy-key').textContent = 'Copied';
    setTimeout(() => ($('#btn-copy-key').textContent = 'Copy key'), 1200);
  });

  $$('#assign-modal [data-close]').forEach((b) =>
    b.addEventListener('click', () => $('#assign-modal').classList.remove('open'))
  );
  $('#btn-assign-confirm').addEventListener('click', async () => {
    const orderId = $('#assign-order-id').value;
    const driverId = $('#assign-driver').value;
    try {
      await API.assignOrder(orderId, driverId);
      $('#assign-modal').classList.remove('open');
      await refreshAll();
    } catch (err) {
      alert(err.message);
    }
  });

  bootstrap();
})();
