const { z } = require('zod');

const nodeCreateSchema = z.object({
  node_type_id: z.coerce.number().int().positive(),
  code: z.string().trim().min(1, 'Kode wajib diisi'),
  name: z.string().trim().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  topology_x: z.coerce.number().int().optional().nullable(),
  topology_y: z.coerce.number().int().optional().nullable()
});

const nodePositionSchema = z.object({
  topology_x: z.coerce.number().int(),
  topology_y: z.coerce.number().int()
});

const linkCreateSchema = z.object({
  source_node_id: z.coerce.number().int().positive(),
  target_node_id: z.coerce.number().int().positive(),
  cable_type: z.string().trim().optional().nullable(),
  core_count: z.coerce.number().int().optional().nullable(),
  core_number: z.string().trim().optional().nullable(),
  pon_name: z.string().trim().optional().nullable(),
  odc_name: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable()
});

const incidentCreateSchema = z.object({
  node_id: z.coerce.number().int().positive().optional().nullable(),
  category: z.enum(['kerusakan', 'internet_mati']),
  title: z.string().trim().min(3, 'Judul minimal 3 karakter'),
  description: z.string().trim().optional().nullable(),
  reporter_name: z.string().trim().optional().nullable(),
  reporter_contact: z.string().trim().optional().nullable(),
  noc_admin_name: z.string().trim().optional().nullable(),
  technician_name: z.string().trim().optional().nullable(),
  technician_contact: z.string().trim().optional().nullable(),
  technician_email: z.string().trim().optional().nullable(),
  work_order_notes: z.string().trim().optional().nullable(),
  technician_report: z.string().trim().optional().nullable(),
  status: z.enum(['reported', 'assigned', 'in_progress', 'completed', 'closed']).optional().nullable()
});

const incidentCompleteSchema = z.object({
  technician_report: z.string().trim().min(3, 'Laporan teknisi wajib diisi'),
  status: z.enum(['completed', 'closed']).optional().nullable()
});

const incidentEmailSchema = z.object({
  to: z.string().trim().min(3, 'Email tujuan wajib'),
  subject: z.string().trim().optional().nullable(),
  message: z.string().trim().optional().nullable(),
  tujuan: z.string().trim().optional().nullable(),
  keperluan: z.string().trim().optional().nullable(),
  teknisi: z.string().trim().optional().nullable(),
  kendaraan: z.string().trim().optional().nullable()
});

const incidentTelegramSchema = z.object({
  chat_id: z.string().trim().min(1, 'Chat ID wajib diisi'),
  message: z.string().trim().optional().nullable()
});

const workReportCreateSchema = z.object({
  incident_id: z.coerce.number().int().positive().optional().nullable(),
  node_id: z.coerce.number().int().positive().optional().nullable(),
  technician_name: z.string().trim().optional().nullable(),
  report_title: z.string().trim().min(3, 'Judul laporan minimal 3 karakter'),
  description: z.string().trim().min(3, 'Keterangan wajib diisi'),
  status: z.enum(['completed', 'closed']).optional().nullable()
});

const loginSchema = z.object({
  email: z.string().trim().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi')
});

const userCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter'),
  email: z.string().trim().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['superadmin', 'admin', 'supervisor_noc', 'teknisi']),
  is_active: z.coerce.number().int().optional().nullable()
});

const userUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter'),
  email: z.string().trim().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter').optional().nullable(),
  role: z.enum(['superadmin', 'admin', 'supervisor_noc', 'teknisi']),
  is_active: z.coerce.number().int().optional().nullable()
});

module.exports = {
  nodeCreateSchema,
  nodePositionSchema,
  linkCreateSchema,
  incidentCreateSchema,
  incidentCompleteSchema,
  incidentEmailSchema,
  incidentTelegramSchema,
  workReportCreateSchema,
  loginSchema,
  userCreateSchema,
  userUpdateSchema
};
