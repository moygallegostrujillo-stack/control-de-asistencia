// Read-only inspection of production Supabase DB
// Usage: DATABASE_URL_PROD="postgresql://..." bun run scripts/inspect-prod.ts
import { Client } from 'pg'

const url = process.env.DATABASE_URL_PROD
if (!url) {
  console.error('Falta DATABASE_URL_PROD')
  process.exit(1)
}

const client = new Client({ connectionString: url, connectionTimeoutMillis: 15000, ssl: { rejectUnauthorized: false } })

async function main() {
  await client.connect()
  console.log('✓ Conectado a producción (Supabase)\n')

  console.log('=== SUCURSALES ===')
  const suc = await client.query('SELECT id, name, "codigoLocal", "isActive", "createdAt" FROM "Sucursal" ORDER BY "createdAt"')
  for (const s of suc.rows) {
    console.log(`- id=${s.id} | name="${s.name}" | codigo=${s.codigoLocal} | active=${s.isActive} | created=${s.createdAt.toISOString()}`)
  }

  console.log('\n=== USERS ===')
  const users = await client.query('SELECT id, email, name, role, "sucursalId", "isActive", "createdAt" FROM "User" ORDER BY "createdAt"')
  for (const u of users.rows) {
    console.log(`- id=${u.id} | email="${u.email}" | name="${u.name}" | role=${u.role} | sucursalId=${u.sucursalId} | active=${u.isActive} | created=${u.createdAt.toISOString()}`)
  }

  console.log('\n=== EMPLOYEES ===')
  const emp = await client.query('SELECT e.id, e."employeeNumber", e."userId", e."sucursalId", e.position, e."isActive", e."createdAt", u.email, u.name as "userName" FROM "Employee" e LEFT JOIN "User" u ON u.id = e."userId" ORDER BY e."createdAt"')
  for (const e of emp.rows) {
    console.log(`- id=${e.id} | num=${e.employeeNumber} | user=${e.email} (${e.userName}) | sucursalId=${e.sucursalId} | position=${e.position} | active=${e.isActive} | created=${e.createdAt.toISOString()}`)
  }

  console.log('\n=== ATTENDANCE RECORDS ===')
  const attCnt = await client.query('SELECT COUNT(*)::int as c FROM "AttendanceRecord"')
  console.log(`Total: ${attCnt.rows[0].c}`)
  const att = await client.query('SELECT a.id, e."employeeNumber", a."sucursalId", a.date, a.status, a."createdAt" FROM "AttendanceRecord" a LEFT JOIN "Employee" e ON e.id = a."employeeId" ORDER BY a."createdAt" DESC LIMIT 40')
  for (const a of att.rows) {
    console.log(`- id=${a.id} | emp=${a.employeeNumber} | sucursalId=${a.sucursalId} | date=${a.date.toISOString().slice(0,10)} | status=${a.status} | created=${a.createdAt.toISOString()}`)
  }

  console.log('\n=== VACATIONS ===')
  const vac = await client.query('SELECT v.id, v."employeeId", v.type, v.status, v."startDate", v."createdAt" FROM "Vacation" v ORDER BY v."createdAt"')
  for (const v of vac.rows) {
    console.log(`- id=${v.id} | empId=${v.employeeId} | type=${v.type} | status=${v.status} | start=${v.startDate.toISOString().slice(0,10)} | created=${v.createdAt.toISOString()}`)
  }

  console.log('\n=== AUDIT LOGS ===')
  const audCnt = await client.query('SELECT COUNT(*)::int as c FROM "AuditLog"')
  console.log(`Total: ${audCnt.rows[0].c}`)
  const aud = await client.query('SELECT id, "userId", action, "entityType", "createdAt" FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 30')
  for (const a of aud.rows) {
    console.log(`- id=${a.id} | userId=${a.userId} | action=${a.action} | entity=${a.entityType} | created=${a.createdAt.toISOString()}`)
  }

  console.log('\n=== WORK SCHEDULES ===')
  const ws = await client.query('SELECT id, "employeeId", "dayOfWeek", "startTime", "endTime", "isWeeklyRest" FROM "WorkSchedule" ORDER BY "employeeId", "dayOfWeek"')
  console.log(`Total: ${ws.rowCount}`)
  for (const w of ws.rows) {
    console.log(`- empId=${w.employeeId} | day=${w.dayOfWeek} | ${w.startTime}-${w.endTime} | rest=${w.isWeeklyRest}`)
  }

  console.log('\n=== HOLIDAYS ===')
  const hol = await client.query('SELECT COUNT(*)::int as c FROM "Holiday"')
  console.log(`Total: ${hol.rows[0].c}`)

  console.log('\n=== DYNAMIC QR ===')
  const qr = await client.query('SELECT COUNT(*)::int as c FROM "DynamicQR"')
  console.log(`Total: ${qr.rows[0].c}`)

  console.log('\n=== COMPANY ===')
  const comp = await client.query('SELECT id, "razonSocial", rfc FROM "Company"')
  for (const c of comp.rows) console.log(`- ${c.id} | ${c.razonSocial} | ${c.rfc}`)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) }).finally(() => client.end())
