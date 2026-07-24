import { db } from '../src/lib/db'

async function main() {
  console.log('=== SUCURSALES ===')
  const sucursales = await db.sucursal.findMany()
  for (const s of sucursales) {
    console.log(`- ${s.id} | ${s.name} | codigo=${s.codigoLocal} | active=${s.isActive} | created=${s.createdAt.toISOString()}`)
  }

  console.log('\n=== USERS ===')
  const users = await db.user.findMany()
  for (const u of users) {
    console.log(`- ${u.id} | ${u.email} | ${u.name} | role=${u.role} | sucursalId=${u.sucursalId} | active=${u.isActive} | created=${u.createdAt.toISOString()}`)
  }

  console.log('\n=== EMPLOYEES ===')
  const employees = await db.employee.findMany()
  for (const e of employees) {
    console.log(`- ${e.id} | num=${e.employeeNumber} | userId=${e.userId} | sucursalId=${e.sucursalId} | position=${e.position} | created=${e.createdAt.toISOString()}`)
  }

  console.log('\n=== ATTENDANCE RECORDS (count) ===')
  const attendanceCount = await db.attendanceRecord.count()
  console.log(`Total: ${attendanceCount}`)
  const recentAttendance = await db.attendanceRecord.findMany({ orderBy: { date: 'desc' }, take: 30, include: { employee: true } })
  for (const a of recentAttendance) {
    console.log(`- ${a.id} | employee=${a.employee.employeeNumber} | sucursalId=${a.sucursalId} | date=${a.date.toISOString()} | status=${a.status}`)
  }

  console.log('\n=== VACATIONS ===')
  const vacs = await db.vacation.findMany()
  for (const v of vacs) {
    console.log(`- ${v.id} | empId=${v.employeeId} | type=${v.type} | status=${v.status} | start=${v.startDate.toISOString()} | created=${v.createdAt.toISOString()}`)
  }

  console.log('\n=== AUDIT LOGS (count) ===')
  const auditCount = await db.auditLog.count()
  console.log(`Total: ${auditCount}`)

  console.log('\n=== HOLIDAYS (count) ===')
  const hCount = await db.holiday.count()
  console.log(`Total: ${hCount}`)

  console.log('\n=== DYNAMIC QR (count) ===')
  const qrCount = await db.dynamicQR.count()
  console.log(`Total: ${qrCount}`)

  console.log('\n=== WORK SCHEDULES ===')
  const ws = await db.workSchedule.findMany()
  for (const w of ws) {
    console.log(`- ${w.id} | empId=${w.employeeId} | day=${w.dayOfWeek} | ${w.startTime}-${w.endTime} | rest=${w.isWeeklyRest}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
