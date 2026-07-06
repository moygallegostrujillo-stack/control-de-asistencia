import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSupabase } from '@/lib/supabase-server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';

/**
 * POST /api/admin/fix-breaks
 * Fix incorrectly flagged break excess records.
 * A break of exactly 30 minutes should NOT be marked as exceeded.
 * Only breaks > 30 minutes are excess.
 * Works with both Prisma (local) and Supabase (production).
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return unauthorizedResponse();
    }

    let fixedCount = 0;
    const errors: string[] = [];

    // Try Supabase first (production)
    const supabase = getSupabase();
    if (supabase) {
      // Fix exceeded_meal where meal_duration <= 30
      const { data: mealRecords, error: mealErr } = await supabase
        .from('attendance_records')
        .select('id, meal_duration, exceeded_meal')
        .eq('exceeded_meal', true)
        .not('meal_duration', 'is', null);

      if (mealErr) {
        errors.push(`supabase-meal-query: ${mealErr.message}`);
      } else if (mealRecords && mealRecords.length > 0) {
        for (const record of mealRecords) {
          if (record.meal_duration <= 30) {
            const { error: updateErr } = await supabase
              .from('attendance_records')
              .update({ exceeded_meal: false })
              .eq('id', record.id);
            if (updateErr) {
              errors.push(`supabase-meal-update-${record.id}: ${updateErr.message}`);
            } else {
              fixedCount++;
            }
          }
        }
      }

      // Fix exceeded_rest where rest_duration <= 30
      const { data: restRecords, error: restErr } = await supabase
        .from('attendance_records')
        .select('id, rest_duration, exceeded_rest')
        .eq('exceeded_rest', true)
        .not('rest_duration', 'is', null);

      if (restErr) {
        errors.push(`supabase-rest-query: ${restErr.message}`);
      } else if (restRecords && restRecords.length > 0) {
        for (const record of restRecords) {
          if (record.rest_duration <= 30) {
            const { error: updateErr } = await supabase
              .from('attendance_records')
              .update({ exceeded_rest: false })
              .eq('id', record.id);
            if (updateErr) {
              errors.push(`supabase-rest-update-${record.id}: ${updateErr.message}`);
            } else {
              fixedCount++;
            }
          }
        }
      }

      // Fix exceeded_break where break_duration <= 30
      const { data: breakRecords, error: breakErr } = await supabase
        .from('attendance_records')
        .select('id, break_duration, exceeded_break')
        .eq('exceeded_break', true)
        .not('break_duration', 'is', null);

      if (breakErr) {
        errors.push(`supabase-break-query: ${breakErr.message}`);
      } else if (breakRecords && breakRecords.length > 0) {
        for (const record of breakRecords) {
          if (record.break_duration <= 30) {
            const { error: updateErr } = await supabase
              .from('attendance_records')
              .update({ exceeded_break: false })
              .eq('id', record.id);
            if (updateErr) {
              errors.push(`supabase-break-update-${record.id}: ${updateErr.message}`);
            } else {
              fixedCount++;
            }
          }
        }
      }
    } else {
      // Fallback to Prisma (local dev)
      try {
        const records = await db.attendanceRecord.findMany({
          where: { exceededMeal: true, mealDuration: { not: null } },
        });
        for (const record of records) {
          if ((record.mealDuration as number) <= 30) {
            await db.attendanceRecord.update({
              where: { id: record.id },
              data: { exceededMeal: false },
            });
            fixedCount++;
          }
        }
      } catch (err) {
        errors.push(`prisma-meal: ${String(err)}`);
      }

      try {
        const records = await db.attendanceRecord.findMany({
          where: { exceededRest: true, restDuration: { not: null } },
        });
        for (const record of records) {
          if ((record.restDuration as number) <= 30) {
            await db.attendanceRecord.update({
              where: { id: record.id },
              data: { exceededRest: false },
            });
            fixedCount++;
          }
        }
      } catch (err) {
        errors.push(`prisma-rest: ${String(err)}`);
      }

      try {
        const records = await db.attendanceRecord.findMany({
          where: { exceededBreak: true, breakDuration: { not: null } },
        });
        for (const record of records) {
          if ((record.breakDuration as number) <= 30) {
            await db.attendanceRecord.update({
              where: { id: record.id },
              data: { exceededBreak: false },
            });
            fixedCount++;
          }
        }
      } catch (err) {
        errors.push(`prisma-break: ${String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      fixedCount,
      message: `Se corrigieron ${fixedCount} registros. Descansos de 30 minutos o menos ya no se marcan como exceso.`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[fix-breaks] Error:', error);
    return NextResponse.json({ error: 'Error al corregir registros' }, { status: 500 });
  }
}
