/**
 * TEST E2E — Caso Gabriela Alvarez (falso positivo "Sobrecarga sostenida")
 *
 * Escenario: empleado que sale ~10 min tarde 3 días consecutivos.
 *   ANTES del fix: 3 días con ot > 0 → alerta CONSECUTIVE_LONG_DAYS (falso positivo)
 *   DESPUÉS del fix: solo días con ot >= 30 min cuentan → NO alerta
 *
 * Verifica:
 *   1) 3 días consecutivos con 10 min de OT  → NO genera alerta (fix)
 *   2) 3 días consecutivos con 45 min de OT  → SÍ genera alerta (patrón real)
 *   3) 2 días con 45 min + 1 día con 10 min  → NO genera alerta (racha rota)
 *
 * Crea registros de prueba en la DB local, llama al API real, y limpia al final.
 */
import { db } from '/home/z/my-project/src/lib/db';

const BASE = 'http://localhost:3000';
const WEEK = { start: '2026-08-31', end: '2026-09-06' }; // lun..dom de la semana actual

async function main() {
  // --- Setup: login como admin general ---
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@control.com', password: 'Admin#2025' }),
  });
  if (!loginRes.ok) throw new Error(`login falló: ${loginRes.status}`);
  const setCookie = loginRes.headers.getSetCookie?.() || [loginRes.headers.get('set-cookie') || ''];
  const cookie = setCookie.map((c: string) => c.split(';')[0]).join('; ');

  // Aceptar aviso de privacidad (middleware bloquea APIs si falta consentimiento)
  await fetch(`${BASE}/api/user/privacy/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ version: '1.0' }),
  }).catch(() => {});

  // --- Tomar un empleado activo con horario L-V (seed) ---
  const emp = await db.employee.findFirst({
    where: { isActive: true },
    include: { user: { select: { name: true } }, sucursal: true, workSchedules: true },
  });
  if (!emp) throw new Error('no hay empleados activos en la DB local');
  console.log(`Empleado de prueba: ${emp.user.name} (${emp.employeeNumber}), sucursal=${emp.sucursalId}`);

  // --- Crear/actualizar registros de asistencia de prueba ---
  async function setOvertime(days: { iso: string; ot: number }[]) {
    for (const { iso, ot } of days) {
      const date = new Date(`${iso}T12:00:00.000Z`);
      const existing = await db.attendanceRecord.findFirst({
        where: { employeeId: emp.id, date: { gte: new Date(`${iso}T00:00:00.000Z`), lte: new Date(`${iso}T23:59:59.999Z`) } },
      });
      const data = {
        overtimeMinutes: ot,
        overtimeDoubleMinutes: ot,
        overtimeTripleMinutes: 0,
        workedMinutes: ot > 0 ? 480 + ot : 480,
        status: 'PRESENT',
      };
      if (existing) {
        await db.attendanceRecord.update({ where: { id: existing.id }, data });
      } else {
        await db.attendanceRecord.create({
          data: {
            employeeId: emp.id,
            sucursalId: emp.sucursalId,
            date,
            checkInTime: new Date(`${iso}T15:00:00.000Z`), // 09:00 MX
            checkOutTime: new Date(`${iso}T23:00:00.000Z`), // 17:00 MX (+ot, aproximado)
            ...data,
          },
        });
      }
    }
  }

  async function getStreakAlerts(): Promise<{ desc: string; level: string }[]> {
    const res = await fetch(`${BASE}/api/alerts/nom-035?startDate=${WEEK.start}&endDate=${WEEK.end}`, {
      headers: { cookie },
    });
    if (!res.ok) throw new Error(`API falló: ${res.status}`);
    const data = await res.json();
    const mine = (data.alerts || []).filter((a: any) => a.employeeId === emp.id && a.type === 'CONSECUTIVE_LONG_DAYS');
    return mine.map((a: any) => ({ desc: a.description, level: a.level }));
  }

  async function clean() {
    await db.attendanceRecord.deleteMany({
      where: { employeeId: emp.id, date: { gte: new Date(`${WEEK.start}T00:00:00.000Z`), lte: new Date(`${WEEK.end}T23:59:59.999Z`) } },
    });
  }

  await clean();
  let failures = 0;

  // --- CASO 1: 3 días con 10 min (el caso Gabriela) → NO debe alertar ---
  await setOvertime([
    { iso: '2026-08-31', ot: 10 },
    { iso: '2026-09-01', ot: 12 },
    { iso: '2026-09-02', ot: 8 },
  ]);
  let alerts = await getStreakAlerts();
  const case1Ok = alerts.length === 0;
  console.log(`\nCASO 1 — 3 días consecutivos con 10/12/8 min extra (caso Gabriela):`);
  console.log(`  Alertas CONSECUTIVE_LONG_DAYS: ${alerts.length} → ${case1Ok ? '✅ CORRECTO (no alerta)' : '❌ FALLO: ' + JSON.stringify(alerts)}`);
  if (!case1Ok) failures++;

  // --- CASO 2: 3 días con 45 min (patrón real de sobrecarga) → SÍ debe alertar ---
  await setOvertime([
    { iso: '2026-08-31', ot: 45 },
    { iso: '2026-09-01', ot: 50 },
    { iso: '2026-09-02', ot: 40 },
  ]);
  alerts = await getStreakAlerts();
  const case2Ok = alerts.length === 1 && alerts[0].level === 'MEDIUM' && alerts[0].desc.includes('135 min');
  console.log(`\nCASO 2 — 3 días consecutivos con 45/50/40 min extra (racha real):`);
  console.log(`  Alertas: ${alerts.length}, nivel=${alerts[0]?.level ?? '—'}`);
  console.log(`  Descripción: ${alerts[0]?.desc ?? '—'}`);
  console.log(`  → ${case2Ok ? '✅ CORRECTO (alerta MEDIUM con total 135 min ≈ 2.3h)' : '❌ FALLO'}`);
  if (!case2Ok) failures++;

  // --- CASO 3: 2 días grandes + 1 día trivial (racha rota) → NO debe alertar ---
  await setOvertime([
    { iso: '2026-08-31', ot: 45 },
    { iso: '2026-09-01', ot: 50 },
    { iso: '2026-09-02', ot: 10 },
  ]);
  alerts = await getStreakAlerts();
  const case3Ok = alerts.length === 0;
  console.log(`\nCASO 3 — racha de 2 días grandes (45/50) + día trivial (10 min):`);
  console.log(`  Alertas CONSECUTIVE_LONG_DAYS: ${alerts.length} → ${case3Ok ? '✅ CORRECTO (racha < 3, no alerta)' : '❌ FALLO: ' + JSON.stringify(alerts)}`);
  if (!case3Ok) failures++;

  // --- Limpieza ---
  await clean();
  console.log(`\nRegistros de prueba eliminados. DB limpia.`);

  if (failures > 0) {
    console.log(`\n❌ ${failures} caso(s) fallaron`);
    process.exit(1);
  }
  console.log(`\n✅ Los 3 casos pasaron — fix verificado end-to-end.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
