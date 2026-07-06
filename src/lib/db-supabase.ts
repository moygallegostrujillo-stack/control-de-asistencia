import { supabase } from './supabase-server';

// ============================================================
// Supabase Database Adapter – Prisma-compatible API
// Used on Vercel production where DATABASE_URL is not available
// ============================================================

const TABLE_NAMES: Record<string, string> = {
  user: 'users', employee: 'employees', workSchedule: 'work_schedules',
  attendanceRecord: 'attendance_records', auditLog: 'audit_logs',
  dynamicQR: 'dynamic_qrs', sucursal: 'sucursales',
};

const FIELD_MAPS: Record<string, Record<string, string>> = {
  user: { passwordHash: 'password_hash', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at' },
  employee: { employeeNumber: 'employee_number', userId: 'user_id', createdAt: 'created_at', updatedAt: 'updated_at' },
  workSchedule: { employeeId: 'employee_id', dayOfWeek: 'day_of_week', startTime: 'start_time', endTime: 'end_time', toleranceMinutes: 'tolerance_minutes', createdAt: 'created_at', updatedAt: 'updated_at' },
  attendanceRecord: { employeeId: 'employee_id', checkInTime: 'check_in_time', checkOutTime: 'check_out_time', checkInLatitude: 'check_in_latitude', checkInLongitude: 'check_in_longitude', checkOutLatitude: 'check_out_latitude', checkOutLongitude: 'check_out_longitude', checkInMethod: 'check_in_method', checkOutMethod: 'check_out_method', checkInIpAddress: 'check_in_ip_address', checkOutIpAddress: 'check_out_ip_address', mealStart: 'meal_start', mealEnd: 'meal_end', mealDuration: 'meal_duration', exceededMeal: 'exceeded_meal', restStart: 'rest_start', restEnd: 'rest_end', restDuration: 'rest_duration', exceededRest: 'exceeded_rest', breakStart: 'break_start', breakEnd: 'break_end', breakDuration: 'break_duration', exceededBreak: 'exceeded_break', isLocked: 'is_locked', createdAt: 'created_at' },
  auditLog: { userId: 'user_id', entityType: 'entity_type', entityId: 'entity_id', ipAddress: 'ip_address', userAgent: 'user_agent', createdAt: 'created_at' },
  dynamicQR: { expiresAt: 'expires_at', createdAt: 'created_at' },
  sucursal: { isActive: 'is_active', mealToleranceMinutes: 'meal_tolerance_minutes', restToleranceMinutes: 'rest_tolerance_minutes', breakToleranceMinutes: 'break_tolerance_minutes', createdAt: 'created_at', updatedAt: 'updated_at' },
};

const RELATIONS: Record<string, Record<string, { table: string; fk: string; model: string }>> = {
  user: { employee: { table: 'employees', fk: 'user_id', model: 'employee' }, auditLogs: { table: 'audit_logs', fk: 'user_id', model: 'auditLog' } },
  employee: { user: { table: 'users', fk: 'user_id', model: 'user' }, workSchedules: { table: 'work_schedules', fk: 'employee_id', model: 'workSchedule' }, attendanceRecords: { table: 'attendance_records', fk: 'employee_id', model: 'attendanceRecord' } },
  workSchedule: { employee: { table: 'employees', fk: 'employee_id', model: 'employee' } },
  attendanceRecord: { employee: { table: 'employees', fk: 'employee_id', model: 'employee' } },
  auditLog: { user: { table: 'users', fk: 'user_id', model: 'user' } },
};

const COMPOSITE_KEYS: Record<string, Record<string, [string, string]>> = {
  attendanceRecord: { employeeId_date: ['employee_id', 'date'] },
  workSchedule: { employeeId_dayOfWeek: ['employee_id', 'day_of_week'] },
};

// ---------- Utilities ----------

function camelToSnake(s: string): string { return s.replace(/[A-Z]/g, m => '_' + m.toLowerCase()); }
function snakeToCamel(s: string): string { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }
function mapField(model: string, field: string): string { return FIELD_MAPS[model]?.[field] || camelToSnake(field); }

function toSnake(model: string, obj: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof Date) r[mapField(model, k)] = v.toISOString();
    else r[mapField(model, k)] = v;
  }
  return r;
}

function toCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (typeof obj === 'object' && obj.constructor === Object) {
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) r[snakeToCamel(k)] = toCamel(v);
    return r;
  }
  return obj;
}

// ---------- Select Builder ----------

function buildSelect(model: string, include?: Record<string, unknown>, select?: Record<string, unknown>): string {
  const rels = RELATIONS[model] || {};
  const parts: string[] = [];

  if (select) {
    for (const [k, v] of Object.entries(select)) {
      if (!v) continue;
      if (rels[k]) {
        const rel = rels[k];
        const inner = typeof v === 'object' && v !== true ? buildSelect(rel.model, (v as Record<string, unknown>).include, v as Record<string, unknown>) : '*';
        parts.push(`${k}:${rel.table}!${rel.fk}(${inner})`);
      } else {
        parts.push(mapField(model, k));
      }
    }
  } else {
    parts.push('*');
  }

  if (include) {
    for (const [relName, relSpec] of Object.entries(include)) {
      const rel = rels[relName];
      if (!rel) continue;
      const inner = typeof relSpec === 'object' && relSpec !== null && relSpec !== true
        ? buildSelect(rel.model, (relSpec as Record<string, unknown>).include, (relSpec as Record<string, unknown>).select)
        : '*';
      parts.push(`${relName}:${rel.table}!${rel.fk}(${inner})`);
    }
  }

  return parts.join(',');
}

// ---------- Where Builder ----------

type SBQuery = ReturnType<ReturnType<typeof supabase.from>['select']>;

function hasRelationFilter(model: string, where: Record<string, unknown>): boolean {
  const rels = RELATIONS[model] || {};
  for (const key of Object.keys(where)) {
    if (key === 'OR') {
      for (const w of (where[key] as Record<string, unknown>[])) {
        if (hasRelationFilter(model, w)) return true;
      }
    } else if (rels[key]) {
      return true;
    }
  }
  return false;
}

function applyWhere(query: SBQuery, model: string, where: Record<string, unknown>): SBQuery {
  const rels = RELATIONS[model] || {};
  let q = query;

  for (const [key, value] of Object.entries(where)) {
    if (key === 'OR' && Array.isArray(value)) {
      const parts = (value as Record<string, unknown>[]).map(w => buildOrString(model, w));
      q = q.or(parts.join(','));
      continue;
    }

    if (rels[key] && typeof value === 'object' && value !== null && !isOp(value)) {
      const rel = rels[key];
      for (const [fk, fv] of Object.entries(value as Record<string, unknown>)) {
        const sfk = mapField(rel.model, fk);
        if (isOpVal(fv)) { q = applyOp(q, `${key}.${sfk}`, fv); }
        else { q = q.eq(`${key}.${sfk}`, fv); }
      }
      continue;
    }

    const sk = mapField(model, key);
    if (isOpVal(value)) { q = applyOp(q, sk, value); }
    else { q = q.eq(sk, value); }
  }

  return q;
}

function isOp(val: unknown): boolean {
  return typeof val === 'object' && val !== null && !Array.isArray(val) && Object.keys(val).some(k => ['contains', 'gte', 'lte', 'lt', 'gt', 'in'].includes(k));
}
function isOpVal(val: unknown): boolean { return typeof val === 'object' && val !== null && !Array.isArray(val) && isOp(val); }

function applyOp(q: SBQuery, col: string, val: Record<string, unknown>): SBQuery {
  if ('contains' in val) q = q.ilike(col, `%${val.contains}%`);
  if ('gte' in val) q = q.gte(col, val.gte instanceof Date ? val.gte.toISOString() : val.gte as string);
  if ('lte' in val) q = q.lte(col, val.lte instanceof Date ? val.lte.toISOString() : val.lte as string);
  if ('lt' in val) q = q.lt(col, val.lt instanceof Date ? val.lt.toISOString() : val.lt as string);
  if ('gt' in val) q = q.gt(col, val.gt instanceof Date ? val.gt.toISOString() : val.gt as string);
  if ('in' in val && Array.isArray(val.in)) q = q.in(col, val.in as unknown[]);
  return q;
}

function buildOrString(model: string, where: Record<string, unknown>): string {
  const rels = RELATIONS[model] || {};
  const parts: string[] = [];
  for (const [key, value] of Object.entries(where)) {
    if (rels[key] && typeof value === 'object' && value !== null && !isOp(value)) {
      const rel = rels[key];
      for (const [fk, fv] of Object.entries(value as Record<string, unknown>)) {
        const sfk = mapField(rel.model, fk);
        if (isOpVal(fv) && 'contains' in (fv as Record<string, unknown>)) parts.push(`${key}.${sfk}.ilike.%${(fv as { contains: string }).contains}%`);
        else parts.push(`${key}.${sfk}.eq.${fv}`);
      }
    } else {
      const sk = mapField(model, key);
      if (isOpVal(value) && 'contains' in (value as Record<string, unknown>)) parts.push(`${sk}.ilike.%${(value as { contains: string }).contains}%`);
      else parts.push(`${sk}.eq.${value}`);
    }
  }
  return parts.join(',');
}

function makeInner(selectStr: string, model: string, where: Record<string, unknown>): string {
  const rels = RELATIONS[model] || {};
  let result = selectStr;
  for (const key of Object.keys(where)) {
    if (key === 'OR') {
      for (const w of (where[key] as Record<string, unknown>[])) {
        for (const wk of Object.keys(w)) {
          if (rels[wk]) result = result.replace(`${wk}:${rels[wk].table}!${rels[wk].fk}(`, `${wk}:${rels[wk].table}!${rels[wk].fk}!inner(`);
        }
      }
    }
    if (rels[key]) {
      result = result.replace(`${key}:${rels[key].table}!${rels[key].fk}(`, `${key}:${rels[key].table}!${rels[key].fk}!inner(`);
    }
  }
  return result;
}

// ---------- Model Adapter ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>;

function createModel(name: string) {
  const table = TABLE_NAMES[name];

  return {
    findUnique: async (args: { where: AnyRec; include?: AnyRec; select?: AnyRec }) => {
      let sel = buildSelect(name, args.include, args.select);

      // Auto-add relations from where clause that aren't already in select/include
      if (args.where && args.select) {
        const rels = RELATIONS[name] || {};
        for (const key of Object.keys(args.where)) {
          if (key === 'OR') continue;
          if (rels[key] && !sel.includes(`${key}:${rels[key].table}`)) {
            const rel = rels[key];
            const innerSelect = typeof args.where[key] === 'object' && args.where[key] !== null
              ? Object.keys(args.where[key] as AnyRec).map(k => mapField(rel.model, k)).join(',')
              : '*';
            sel += `,${key}:${rel.table}!${rel.fk}(${innerSelect})`;
          }
        }
      }

      const hasRel = hasRelationFilter(name, args.where);
      if (hasRel) sel = makeInner(sel, name, args.where);

      let q: SBQuery = supabase.from(table).select(sel);

      // Process where
      for (const [key, value] of Object.entries(args.where)) {
        const comp = COMPOSITE_KEYS[name]?.[key];
        if (comp) {
          const cv = value as AnyRec;
          const ck = Object.keys(cv);
          q = q.eq(comp[0], cv[ck[0]]).eq(comp[1], cv[ck[1]]);
        } else {
          const sk = mapField(name, key);
          const rels = RELATIONS[name] || {};
          if (rels[key] && typeof value === 'object' && !isOp(value)) {
            for (const [fk, fv] of Object.entries(value as AnyRec)) {
              q = q.eq(`${key}.${mapField(rels[key].model, fk)}`, fv);
            }
          } else {
            q = q.eq(sk, value);
          }
        }
      }

      const { data, error } = await q.maybeSingle();
      if (error) { console.error(`[db] findUnique ${name}:`, error.message); return null; }
      return data ? toCamel(data) : null;
    },

    findMany: async (args: { where?: AnyRec; include?: AnyRec; select?: AnyRec; orderBy?: AnyRec; take?: number; skip?: number } = {}) => {
      let sel = buildSelect(name, args.include, args.select);

      // Auto-add relations from where clause that aren't already in select/include
      // This fixes queries like: findMany({ where: { user: { isActive: true } }, select: { sucursal: true } })
      if (args.where && args.select) {
        const rels = RELATIONS[name] || {};
        for (const key of Object.keys(args.where)) {
          if (key === 'OR') continue;
          if (rels[key] && !sel.includes(`${key}:${rels[key].table}`)) {
            const rel = rels[key];
            const innerSelect = typeof args.where[key] === 'object' && args.where[key] !== null
              ? Object.keys(args.where[key] as AnyRec).map(k => mapField(rel.model, k)).join(',')
              : '*';
            sel += `,${key}:${rel.table}!${rel.fk}(${innerSelect})`;
          }
        }
      }

      if (args.where && hasRelationFilter(name, args.where)) sel = makeInner(sel, name, args.where);

      let q: SBQuery = supabase.from(table).select(sel);

      if (args.where) q = applyWhere(q, name, args.where);

      if (args.orderBy) {
        const orders = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
        for (const o of orders) {
          for (const [f, d] of Object.entries(o as AnyRec)) {
            q = q.order(mapField(name, f), { ascending: d === 'asc' });
          }
        }
      }

      if (args.take) q = q.limit(args.take);
      if (args.skip !== undefined && args.take) q = q.range(args.skip, args.skip + args.take - 1);

      const { data, error } = await q;
      if (error) { console.error(`[db] findMany ${name}:`, error.message); return []; }
      return data ? (data as unknown[]).map(d => toCamel(d)) : [];
    },

    create: async (args: { data: AnyRec; include?: AnyRec }) => {
      // Handle nested creates
      const nested: Array<{ relName: string; relData: AnyRec }> = [];
      const clean = { ...args.data };
      const rels = RELATIONS[name] || {};
      for (const [rn] of Object.entries(rels)) {
        if (clean[rn]?.create) {
          nested.push({ relName: rn, relData: clean[rn].create });
          delete clean[rn];
        }
      }

      const snakeData = toSnake(name, clean);
      const { data, error } = await supabase.from(table).insert(snakeData).select().single();
      if (error) { console.error(`[db] create ${name}:`, error.message); throw new Error(`Create failed: ${error.message}`); }

      const result = toCamel(data) as AnyRec;

      // Nested creates
      for (const { relName, relData } of nested) {
        const rel = rels[relName];
        const nestedData = toSnake(rel.model, { ...relData, [name === 'user' && relName === 'employee' ? 'userId' : `${name}Id`]: result.id });
        const { error: nErr } = await supabase.from(rel.table).insert(nestedData).select().single();
        if (nErr) console.error(`[db] nested create ${relName}:`, nErr.message);
      }

      if (args.include && nested.length > 0) {
        return createModel(name).findUnique({ where: { id: result.id }, include: args.include });
      }
      return result;
    },

    update: async (args: { where: AnyRec; data: AnyRec; include?: AnyRec }) => {
      const snakeData = toSnake(name, args.data);
      let q = supabase.from(table).update(snakeData);
      for (const [k, v] of Object.entries(args.where)) q = q.eq(mapField(name, k), v);
      const { data, error } = await q.select().single();
      if (error) { console.error(`[db] update ${name}:`, error.message); throw new Error(`Update failed: ${error.message}`); }
      const result = toCamel(data);
      if (args.include) return createModel(name).findUnique({ where: { id: (result as AnyRec).id }, include: args.include });
      return result;
    },

    delete: async (args: { where: AnyRec }) => {
      let q = supabase.from(table).delete();
      for (const [k, v] of Object.entries(args.where)) q = q.eq(mapField(name, k), v);
      const { data, error } = await q.select().single();
      if (error) { console.error(`[db] delete ${name}:`, error.message); throw new Error(`Delete failed: ${error.message}`); }
      return toCamel(data);
    },

    deleteMany: async (args: { where: AnyRec }) => {
      let q = supabase.from(table).delete();
      for (const [k, v] of Object.entries(args.where)) {
        if (typeof v === 'object' && v !== null && 'lt' in (v as object)) {
          const ltVal = (v as { lt: unknown }).lt;
          q = q.eq(mapField(name, k), ltVal instanceof Date ? ltVal.toISOString() : ltVal);
        } else {
          q = q.eq(mapField(name, k), v);
        }
      }
      const { data, error } = await q.select();
      if (error) { console.error(`[db] deleteMany ${name}:`, error.message); return { count: 0 }; }
      return { count: data?.length || 0 };
    },

    count: async (args: { where?: AnyRec } = {}) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (args.where) {
        for (const [k, v] of Object.entries(args.where)) {
          q = q.eq(mapField(name, k), v);
        }
      }
      const { count, error } = await q;
      if (error) { console.error(`[db] count ${name}:`, error.message); return 0; }
      return count || 0;
    },
  };
}

// ---------- Export ----------

export const db = {
  user: createModel('user'),
  employee: createModel('employee'),
  workSchedule: createModel('workSchedule'),
  attendanceRecord: createModel('attendanceRecord'),
  auditLog: createModel('auditLog'),
  dynamicQR: createModel('dynamicQR'),
  sucursal: createModel('sucursal'),
};
