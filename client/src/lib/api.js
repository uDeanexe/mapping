import { supabase } from './supabase.js';

const BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'uploads';

function asNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isFile(value) {
  return typeof File !== 'undefined' && value instanceof File;
}

function normalizeError(error, fallback = 'Request gagal') {
  const msg = error?.message || fallback;
  const err = new Error(msg);
  err.data = error;
  throw err;
}

async function ensureAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error) normalizeError(error, 'Auth error');
  if (!data?.session) throw new Error('Unauthorized');
  return data.session;
}

async function uploadImage(folder, file) {
  if (!file) return null;
  if (!isFile(file)) throw new Error('File upload tidak valid');

  const session = await ensureAuth();
  const ext = String(file.name || '').split('.').pop() || 'jpg';
  const safeExt = ext.length <= 10 ? ext : 'jpg';
  const key = `${folder}/${session.user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined
  });
  if (upErr) normalizeError(upErr, 'Gagal upload file');

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return data?.publicUrl || null;
}

async function mapNodes(nodes) {
  const typeIds = [...new Set(nodes.map((n) => n.node_type_id).filter(Boolean))];
  let typeById = new Map();
  if (typeIds.length) {
    const { data: types, error } = await supabase
      .from('node_types')
      .select('id,name,label,icon')
      .in('id', typeIds);
    if (error) normalizeError(error, 'Gagal load node types');
    typeById = new Map((types || []).map((t) => [t.id, t]));
  }
  return nodes.map((n) => ({
    ...n,
    type: typeById.get(n.node_type_id)?.name || null
  }));
}

async function nodesIdCodeMap() {
  const { data, error } = await supabase.from('nodes').select('id,code');
  if (error) normalizeError(error, 'Gagal load nodes');
  return new Map((data || []).map((n) => [n.id, n.code]));
}

async function incidentsIdTitleMap() {
  const { data, error } = await supabase.from('incidents').select('id,title');
  if (error) normalizeError(error, 'Gagal load incidents');
  return new Map((data || []).map((i) => [i.id, i.title]));
}

export async function apiGet(path) {
  await ensureAuth();

  if (path === '/api/node-types') {
    const { data, error } = await supabase.from('node_types').select('id,name,label,icon').order('id', { ascending: true });
    if (error) normalizeError(error, 'Gagal load node types');
    return data || [];
  }

  if (path === '/api/nodes') {
    const { data, error } = await supabase
      .from('nodes')
      .select('id,node_type_id,code,name,latitude,longitude,address,photo_path,notes,topology_x,topology_y,created_at,updated_at')
      .order('id', { ascending: false });
    if (error) normalizeError(error, 'Gagal load nodes');
    return mapNodes(data || []);
  }

  if (path === '/api/links') {
    const [{ data: links, error: linksErr }, nodeMap] = await Promise.all([
      supabase
        .from('links')
        .select('id,source_node_id,target_node_id,cable_type,core_count,core_number,pon_name,odc_name,notes,created_at,updated_at')
        .order('id', { ascending: false }),
      nodesIdCodeMap()
    ]);
    if (linksErr) normalizeError(linksErr, 'Gagal load links');
    return (links || []).map((l) => ({
      ...l,
      source_code: nodeMap.get(l.source_node_id) || null,
      target_code: nodeMap.get(l.target_node_id) || null
    }));
  }

  if (path === '/api/incidents') {
    const [{ data: incidents, error }, nodeMap] = await Promise.all([
      supabase
        .from('incidents')
        .select(
          'id,node_id,category,title,description,reporter_name,reporter_contact,photo_path,noc_admin_name,technician_name,technician_contact,technician_email,work_order_notes,technician_report,status,assigned_at,completed_at,created_at,updated_at'
        )
        .order('id', { ascending: false }),
      nodesIdCodeMap()
    ]);
    if (error) normalizeError(error, 'Gagal load incidents');
    return (incidents || []).map((it) => ({ ...it, node_code: it.node_id ? nodeMap.get(it.node_id) || null : null }));
  }

  if (path === '/api/work-reports') {
    const [{ data: rows, error }, nodeMap, incidentMap] = await Promise.all([
      supabase
        .from('work_reports')
        .select('id,incident_id,node_id,technician_name,report_title,description,photo_path,status,created_at,updated_at')
        .order('id', { ascending: false }),
      nodesIdCodeMap(),
      incidentsIdTitleMap()
    ]);
    if (error) normalizeError(error, 'Gagal load work reports');
    return (rows || []).map((r) => ({
      ...r,
      node_code: r.node_id ? nodeMap.get(r.node_id) || null : null,
      incident_title: r.incident_id ? incidentMap.get(r.incident_id) || null : null
    }));
  }

  if (path === '/api/users') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,name,role,is_active,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (error) normalizeError(error, 'Gagal load user');
    return data || [];
  }

  if (path === '/api/dashboard') {
    const [{ count: nodesCount, error: nErr }, { count: linksCount, error: lErr }, { count: incidentsCount, error: iErr }, { count: workCount, error: wErr }] =
      await Promise.all([
        supabase.from('nodes').select('*', { count: 'exact', head: true }),
        supabase.from('links').select('*', { count: 'exact', head: true }),
        supabase.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'closed'),
        supabase.from('work_reports').select('*', { count: 'exact', head: true })
      ]);
    if (nErr) normalizeError(nErr, 'Gagal load dashboard');
    if (lErr) normalizeError(lErr, 'Gagal load dashboard');
    if (iErr) normalizeError(iErr, 'Gagal load dashboard');
    if (wErr) normalizeError(wErr, 'Gagal load dashboard');

    const { data: byStatus, error: bsErr } = await supabase
      .from('incidents')
      .select('status')
      .order('status', { ascending: true });
    if (bsErr) normalizeError(bsErr, 'Gagal load dashboard');
    const statusTotals = new Map();
    for (const row of byStatus || []) {
      const s = row.status || 'unknown';
      statusTotals.set(s, (statusTotals.get(s) || 0) + 1);
    }

    const nodeMap = await nodesIdCodeMap();
    const { data: latest, error: latestErr } = await supabase
      .from('incidents')
      .select('id,node_id,title,status,created_at')
      .order('id', { ascending: false })
      .limit(8);
    if (latestErr) normalizeError(latestErr, 'Gagal load dashboard');

    return {
      totals: {
        nodes: nodesCount || 0,
        links: linksCount || 0,
        incidents_active: incidentsCount || 0,
        work_reports: workCount || 0
      },
      incident_by_status: [...statusTotals.entries()].map(([status, total]) => ({ status, total })),
      latest_incidents: (latest || []).map((row) => ({ ...row, node_code: row.node_id ? nodeMap.get(row.node_id) || null : null }))
    };
  }

  throw new Error(`Endpoint GET tidak didukung: ${path}`);
}

export async function apiDelete(path) {
  await ensureAuth();

  const mNode = path.match(/^\/api\/nodes\/(\d+)$/);
  if (mNode) {
    const id = Number(mNode[1]);
    const { error } = await supabase.from('nodes').delete().eq('id', id);
    if (error) normalizeError(error, 'Gagal hapus node');
    return { message: 'OK' };
  }

  const mLink = path.match(/^\/api\/links\/(\d+)$/);
  if (mLink) {
    const id = Number(mLink[1]);
    const { error } = await supabase.from('links').delete().eq('id', id);
    if (error) normalizeError(error, 'Gagal hapus link');
    return { message: 'OK' };
  }

  const mIncident = path.match(/^\/api\/incidents\/(\d+)$/);
  if (mIncident) {
    const id = Number(mIncident[1]);
    const { error } = await supabase.from('incidents').delete().eq('id', id);
    if (error) normalizeError(error, 'Gagal hapus gangguan');
    return { message: 'OK' };
  }

  const mWork = path.match(/^\/api\/work-reports\/(\d+)$/);
  if (mWork) {
    const id = Number(mWork[1]);
    const { error } = await supabase.from('work_reports').delete().eq('id', id);
    if (error) normalizeError(error, 'Gagal hapus rekam kerja');
    return { message: 'OK' };
  }

  const mUser = path.match(/^\/api\/users\/([0-9a-f-]+)$/i);
  if (mUser) {
    const id = mUser[1];
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) normalizeError(error, 'Gagal hapus user');
    return { message: 'OK' };
  }

  throw new Error(`Endpoint DELETE tidak didukung: ${path}`);
}

export async function apiPostJson(path, body) {
  await ensureAuth();

  if (path === '/api/links') {
    const payload = {
      source_node_id: asNumber(body.source_node_id),
      target_node_id: asNumber(body.target_node_id),
      cable_type: body.cable_type || null,
      core_count: asNumber(body.core_count),
      core_number: body.core_number || null,
      pon_name: body.pon_name || null,
      odc_name: body.odc_name || null,
      notes: body.notes || null
    };
    const { data, error } = await supabase.from('links').insert(payload).select('id').single();
    if (error) normalizeError(error, 'Gagal simpan link');
    return { id: data?.id };
  }

  if (path === '/api/users') {
    // Creating Auth users from a browser app is not recommended (it can switch sessions).
    // Use Supabase Dashboard (Authentication -> Users) or a backend with service-role key.
    throw new Error('Buat user baru harus lewat Supabase Dashboard (Auth Users) atau backend (service-role).');
  }

  // Server-only features (email/telegram) are not supported without backend/service role.
  if (/^\/api\/incidents\/\d+\/send-email$/.test(path) || /^\/api\/incidents\/\d+\/send-telegram$/.test(path)) {
    throw new Error('Fitur ini butuh backend (server) dan tidak didukung saat UI langsung ke Supabase.');
  }

  throw new Error(`Endpoint POST JSON tidak didukung: ${path}`);
}

export async function apiPutJson(path, body) {
  await ensureAuth();
  const m = path.match(/^\/api\/users\/([0-9a-f-]+)$/i);
  if (m) {
    const id = m[1];
    const payload = {
      name: body.name,
      role: body.role,
      is_active: body.is_active === 0 ? 0 : 1,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('profiles').update(payload).eq('id', id);
    if (error) normalizeError(error, 'Gagal update user');
    return { message: 'OK' };
  }
  throw new Error(`Endpoint PUT JSON tidak didukung: ${path}`);
}

export async function apiPatchJson(path, body) {
  await ensureAuth();
  const mPos = path.match(/^\/api\/nodes\/(\d+)\/position$/);
  if (mPos) {
    const id = Number(mPos[1]);
    const payload = { topology_x: asNumber(body.topology_x), topology_y: asNumber(body.topology_y), updated_at: new Date().toISOString() };
    const { error } = await supabase.from('nodes').update(payload).eq('id', id);
    if (error) normalizeError(error, 'Gagal update posisi');
    return { message: 'OK' };
  }

  const mComplete = path.match(/^\/api\/incidents\/(\d+)\/complete$/);
  if (mComplete) {
    const id = Number(mComplete[1]);
    const payload = {
      technician_report: body.technician_report || null,
      status: body.status || 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('incidents').update(payload).eq('id', id);
    if (error) normalizeError(error, 'Gagal simpan selesai');
    return { message: 'OK' };
  }

  throw new Error(`Endpoint PATCH JSON tidak didukung: ${path}`);
}

export async function apiPostForm(path, formData, method = 'POST') {
  await ensureAuth();

  if (!(formData instanceof FormData)) throw new Error('FormData tidak valid');

  // Nodes create/update
  if (path === '/api/nodes' && method === 'POST') {
    const file = formData.get('photo');
    const photoUrl = isFile(file) ? await uploadImage('nodes', file) : null;
    const payload = {
      node_type_id: asNumber(formData.get('node_type_id')),
      code: String(formData.get('code') || '').trim(),
      name: formData.get('name') ? String(formData.get('name')) : null,
      latitude: asNumber(formData.get('latitude')),
      longitude: asNumber(formData.get('longitude')),
      address: formData.get('address') ? String(formData.get('address')) : null,
      notes: formData.get('notes') ? String(formData.get('notes')) : null,
      photo_path: photoUrl,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('nodes').insert(payload).select('id').single();
    if (error) normalizeError(error, 'Gagal simpan node');
    return { id: data?.id };
  }

  const mNodePut = path.match(/^\/api\/nodes\/(\d+)$/);
  if (mNodePut && method === 'PUT') {
    const id = Number(mNodePut[1]);
    const file = formData.get('photo');
    const photoUrl = isFile(file) ? await uploadImage('nodes', file) : null;
    const payload = {
      node_type_id: asNumber(formData.get('node_type_id')),
      code: String(formData.get('code') || '').trim(),
      name: formData.get('name') ? String(formData.get('name')) : null,
      latitude: asNumber(formData.get('latitude')),
      longitude: asNumber(formData.get('longitude')),
      address: formData.get('address') ? String(formData.get('address')) : null,
      notes: formData.get('notes') ? String(formData.get('notes')) : null,
      updated_at: new Date().toISOString()
    };
    if (photoUrl) payload.photo_path = photoUrl;
    const { error } = await supabase.from('nodes').update(payload).eq('id', id);
    if (error) normalizeError(error, 'Gagal update node');
    return { message: 'OK' };
  }

  // Incidents create/update
  if (path === '/api/incidents' && method === 'POST') {
    const file = formData.get('photo');
    const photoUrl = isFile(file) ? await uploadImage('incidents', file) : null;
    const payload = {
      node_id: asNumber(formData.get('node_id')),
      category: String(formData.get('category') || 'kerusakan'),
      title: String(formData.get('title') || '').trim(),
      description: formData.get('description') ? String(formData.get('description')) : null,
      reporter_name: formData.get('reporter_name') ? String(formData.get('reporter_name')) : null,
      reporter_contact: formData.get('reporter_contact') ? String(formData.get('reporter_contact')) : null,
      photo_path: photoUrl,
      noc_admin_name: formData.get('noc_admin_name') ? String(formData.get('noc_admin_name')) : null,
      technician_name: formData.get('technician_name') ? String(formData.get('technician_name')) : null,
      technician_contact: formData.get('technician_contact') ? String(formData.get('technician_contact')) : null,
      technician_email: formData.get('technician_email') ? String(formData.get('technician_email')) : null,
      work_order_notes: formData.get('work_order_notes') ? String(formData.get('work_order_notes')) : null,
      technician_report: formData.get('technician_report') ? String(formData.get('technician_report')) : null,
      status: formData.get('status') ? String(formData.get('status')) : 'reported',
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('incidents').insert(payload).select('id').single();
    if (error) normalizeError(error, 'Gagal simpan gangguan');
    return { id: data?.id };
  }

  const mIncPut = path.match(/^\/api\/incidents\/(\d+)$/);
  if (mIncPut && method === 'PUT') {
    const id = Number(mIncPut[1]);
    const file = formData.get('photo');
    const photoUrl = isFile(file) ? await uploadImage('incidents', file) : null;
    const payload = {
      node_id: asNumber(formData.get('node_id')),
      category: formData.get('category') ? String(formData.get('category')) : undefined,
      title: formData.get('title') ? String(formData.get('title')).trim() : undefined,
      description: formData.get('description') ? String(formData.get('description')) : undefined,
      reporter_name: formData.get('reporter_name') ? String(formData.get('reporter_name')) : undefined,
      reporter_contact: formData.get('reporter_contact') ? String(formData.get('reporter_contact')) : undefined,
      noc_admin_name: formData.get('noc_admin_name') ? String(formData.get('noc_admin_name')) : undefined,
      technician_name: formData.get('technician_name') ? String(formData.get('technician_name')) : undefined,
      technician_contact: formData.get('technician_contact') ? String(formData.get('technician_contact')) : undefined,
      technician_email: formData.get('technician_email') ? String(formData.get('technician_email')) : undefined,
      work_order_notes: formData.get('work_order_notes') ? String(formData.get('work_order_notes')) : undefined,
      technician_report: formData.get('technician_report') ? String(formData.get('technician_report')) : undefined,
      status: formData.get('status') ? String(formData.get('status')) : undefined,
      updated_at: new Date().toISOString()
    };
    if (photoUrl) payload.photo_path = photoUrl;
    const { error } = await supabase.from('incidents').update(payload).eq('id', id);
    if (error) normalizeError(error, 'Gagal update gangguan');
    return { message: 'OK' };
  }

  // Work reports create (photo optional)
  if (path === '/api/work-reports' && method === 'POST') {
    const file = formData.get('photo');
    const photoUrl = isFile(file) ? await uploadImage('reports', file) : null;
    const payload = {
      incident_id: asNumber(formData.get('incident_id')),
      node_id: asNumber(formData.get('node_id')),
      technician_name: formData.get('technician_name') ? String(formData.get('technician_name')) : null,
      report_title: String(formData.get('report_title') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      photo_path: photoUrl,
      status: formData.get('status') ? String(formData.get('status')) : 'completed',
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('work_reports').insert(payload).select('id').single();
    if (error) normalizeError(error, 'Gagal simpan rekam kerja');
    return { id: data?.id };
  }

  throw new Error(`Endpoint FORM tidak didukung: ${method} ${path}`);
}
