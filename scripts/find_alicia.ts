import { db } from '../src/lib/db'

async function main() {
  // First, list all employees to see what's in the DB
  const allEmployees = await db.employee.findMany({
    include: { user: true, sucursal: true },
    take: 50,
    orderBy: { employeeNumber: 'asc' }
  })
  console.log('=== ALL EMPLOYEES:', allEmployees.length)
  for (const e of allEmployees) {
    console.log(`${e.employeeNumber} | ${e.user.name} | ${e.sucursal.name} | ${e.position}`)
  }
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
