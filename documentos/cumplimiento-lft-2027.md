# Control de Asistencia
## Documento de cumplimiento con la Reforma a la Ley Federal del Trabajo (LFT) 2027

**Sistema:** Control de Asistencia v2.2
**Normativa aplicable:**
- Reforma a la Ley Federal del Trabajo (LFT), publicada en el Diario Oficial de la Federación el 1 de mayo de 2026, con entrada en vigor el **1 de enero de 2027**.
- NOM-037-STPS-2023 (Trabajo a distancia).
- NOM-035-STPS-2018 (Factores de riesgo psicosocial).

**Fecha del documento:** Junio 2026
**Audiencia:** Personal sin conocimientos de programación (recursos humanos, legal, gerencia).

---

## Cómo leer este documento

Para cada función del sistema se indica:

1. **Qué hace el sistema** (en palabras simples).
2. **Qué artículo de la ley cumple** (con su número exacto).
3. **Cómo se cumple** (qué pasa en la práctica cuando se usa la función).

Al final hay una **tabla resumen** que cruza todas las funciones con los artículos de ley.

---

## 1. Registro electrónico de asistencia obligatorio

### Qué dice la ley
La **Reforma LFT 2027** añade al **artículo 132, fracción XXXIV** de la Ley Federal del Trabajo la obligación del patrón de llevar un **registro electrónico de asistencia** de sus trabajadores, que permita conocer con precisión la hora de entrada y salida, así como el tiempo de comida.

Antes de 2027, este registro era opcional o se llevaba en papel. A partir del 1 de enero de 2027, **es obligatorio en formato electrónico**.

### Qué hace el sistema
- Cada trabajador registra su **entrada, salida, inicio y fin de comida** mediante un código QR personal que se escanea en un terminal, o ingresando con su usuario y contraseña desde cualquier dispositivo.
- La **hora exacta** (con minuto y segundo) queda registrada automáticamente; ni el trabajador ni el patrón pueden escribirla a mano.
- El sistema guarda también el **día y la fecha** del registro.

### Cómo se cumple el art. 132, fracción XXXIV LFT
Cada vez que un trabajador entra o sale, el sistema crea un registro electrónico con:
- Fecha y hora exactas (no modificables por el trabajador).
- Identidad del trabajador (su número de empleado y nombre).
- Sucursal donde se registró.

Este registro **sustituye al papel** y cumple el requisito de "registro electrónico" exigido por la ley a partir de 2027.

---

## 2. Conservación de los registros por 12 meses

### Qué dice la ley
El **artículo 804 de la LFT** obliga a los patrones a conservar los registros de asistencia y de jornada de trabajo **por un mínimo de 12 meses**. Estos documentos deben estar disponibles para inspección del trabajo y para el trabajador si los solicita.

### Qué hace el sistema
- Todos los registros de entrada, salida y comida se guardan en una base de datos permanente.
- El sistema permite **consultar el historial** de un trabajador por cualquier rango de fechas (hasta 366 días por consulta).
- Se pueden **exportar** los registros a PDF o Excel para entregarlos al trabajador o a la autoridad laboral.
- Los registros **no se borran** automáticamente; permanecen disponibles de forma indefinida (supera el mínimo legal de 12 meses).

### Cómo se cumple el art. 804 LFT
El sistema retiene los registros electrónicos de asistencia por más de 12 meses, permitiendo:
- Consulta inmediata desde la pantalla "Historial".
- Exportación a PDF/Excel con un clic.
- Conservación de los registros incluso después de que el trabajador sea desactivado (los registros históricos se conservan por integridad legal).

---

## 3. Registro de jornada: respeto a la jornada máxima legal

### Qué dice la ley
- **Art. 61 LFT:** La jornada diaria máxima es de 8 horas (diurna), 7 (nocturna) o 7.5 (mixta).
- **Art. 59 LFT:** El trabajador tiene derecho a un día de descanso por cada seis de trabajo.
- **Art. 60 LFT:** El día de descanso es preferentemente el domingo.

### Qué hace el sistema
- Al dar de alta un empleado, el patrón debe **asignar manualmente el horario semanal**, indicando para cada día:
  - **Trabaja** (con hora de entrada y salida).
  - **Descanso** (día de descanso semanal).
  - **No laborable** (el empleado no trabaja ese día).
- El sistema **no permite** guardar el horario si no hay al menos un día marcado como "Descanso" (ver sección 5).
- Esto permite manejar **turnos rotativos**: por ejemplo, un empleado puede entrar el lunes a las 9 y el martes a las 11, con horarios distintos cada día.

### Cómo se cumple el art. 61 LFT
El sistema calcula automáticamente las **horas trabajadas reales** cada día, comparando la hora de entrada y salida registradas con el horario asignado. Si el trabajador excede la jornada, el sistema lo marca y calcula las horas extra (ver sección 6).

---

## 4. Cálculo automático de horas extra (dobles y triples)

### Qué dice la ley
- **Art. 66 LFT:** Las horas extra se pagan **al doble** durante las primeras 9 horas extra a la semana.
- **Art. 67 y 68 LFT:** Las horas extra que excedan de 9 a la semana se pagan **al triple**.
- **Transitorio Cuarto** de la reforma (DOF 1-may-2026): A partir de 2027, el tope máximo de horas extra semanales es de **9 horas**. A partir de 2030, subirá a 12 horas.

### Qué hace el sistema
Cada vez que un trabajador registra su salida, el sistema calcula automáticamente:
1. **Horas extra dobles:** las primeras 9 horas extra de la semana (se pagan al doble).
2. **Horas extra triples:** las horas extra que excedan de 9 a la semana (se pagan al triple).
3. **Tope semanal:** si las horas extra de la semana superan las 9 (en 2027), el sistema genera una **alerta automática** (ver sección 8).

### Cómo se cumplen los arts. 66, 67 y 68 LFT
El cálculo se hace automáticamente al registrar la salida, sin que el patrón tenga que hacerlo a mano. El sistema distingue entre:
- **Horas extra dobles** (primeras 9 de la semana) → se muestran por separado en los reportes.
- **Horas extra triples** (excedentes) → se muestran por separado en los reportes.

Los reportes de nómina muestran cuántas horas extra dobles y cuántas triples tiene cada trabajador, listas para calcularse el pago correcto.

### Cómo se cumple el Transitorio Cuarto (tope de 9 horas)
El sistema tiene configurado el tope de 9 horas extra semanales para 2027. Si un trabajador excede este tope, el sistema **genera una alerta NOM-035** (ver sección 8) que avisa al patrón que está infringiendo el límite legal.

---

## 5. Día de descanso semanal obligatorio

### Qué dice la ley
- **Art. 69 LFT:** Todo trabajador tiene derecho a un día de descanso por cada seis de trabajo.
- **Art. 71 LFT:** El día de descanso semanal es obligatorio y preferentemente el domingo. Cuando el día de descanso sea domingo, el trabajador tiene derecho a una prima dominical adicional del 25% sobre el salario ordinario.
- **Art. 73 LFT:** Si el trabajador labora en su día de descanso semanal, se paga con una **prima del 100% adicional** al salario ordinario (es decir, salario doble por ese día).

### Qué hace el sistema
- Al crear o editar un empleado, el sistema **obliga** a marcar al menos un día de la semana como "Descanso".
- Si el patrón intenta guardar el horario sin marcar un día de descanso, el sistema **bloquea el guardado** y muestra el mensaje:
  > "El horario debe incluir al menos 1 día de descanso semanal (art. 71 LFT)."
- Se pueden marcar **varios días de descanso** si la empresa así lo requiere (por ejemplo, sábado y domingo).
- **Detección de descanso trabajado (art. 73 LFT):** cuando un trabajador registra su entrada en un día marcado como descanso semanal, el sistema:
  1. **Permite el check-in** (la LFT no prohíbe trabajar en descanso, solo impone la prima).
  2. **Marca el registro** con `isRestDayWorked = true` y `isSunday` según corresponda.
  3. **Al hacer check-out**, calcula y persiste automáticamente:
     - `restDayWorkedMinutes`: minutos trabajados en el descanso (jornada completa).
     - `restDayPremiumMinutes`: prima del 100% adicional (art. 73 LFT), igual a `restDayWorkedMinutes`.
  4. **Genera una alerta NOM-035** tipo `REST_DAY_WORKED` (nivel HIGH si es domingo, MEDIUM si no) que aparece en el badge de notificaciones del admin y queda como evidencia auditable.
  5. **No cuenta esos minutos como horas extra** (art. 66/68) — el descanso trabajado es jornada ordinaria con recargo del 100%, no tiempo extra.
- **Reportes de nómina:** todos los reportes (horas extra, diario, incidencias, comparativo, exportación XLSX/CSV del admin y del empleado) incluyen columnas separadas para:
  - Horas extra dobles (art. 66)
  - Horas extra triples (art. 68)
  - Día de descanso trabajado (Sí/No)
  - Prima del 100% (minutos) — art. 73 LFT
  - Domingo (Sí/No) — para prima dominical art. 71 LFT

### Cómo se cumple el art. 71 y 73 LFT
La validación y cálculo ocurren en varios lugares:
1. **Al crear/editar el empleado:** el sistema no permite guardar si no hay día de descanso (validación backend + frontend, cita art. 71 LFT).
2. **Al hacer check-in en día de descanso:** el sistema detecta automáticamente que la fecha es `isWeeklyRest` y marca `isRestDayWorked = true`.
3. **Al hacer check-out:** el sistema calcula `restDayWorkedMinutes` y `restDayPremiumMinutes` (prima del 100%) y los persiste en el registro. Estos minutos **no** se acumulan como overtime.
4. **En reportes:** las columnas separadas permiten al patrón calcular el pago correcto: salario ordinario + prima del 100% por cada minuto en `restDayPremiumMinutes`.
5. **Alerta NOM-035:** el descanso trabajado genera una alerta auditable para evidencia ante una revisión de la STPS.

---

## 6. Inmutabilidad de los registros (no se pueden alterar)

### Qué dice la ley
El espíritu de la reforma LFT 2027 y de la NOM-037-STPS-2023 es que los registros de asistencia **sean confiables y no se puedan manipular** a discreción del patrón, para evitar fraudes en el pago de horas extra y jornadas.

### Qué hace el sistema
- Cuando un trabajador registra su entrada o salida, la **hora original** se guarda y **no puede modificarse**.
- El registro queda **"bloqueado"** (sellado) con la hora exacta en que se generó.
- Si se necesita corregir un registro (por error de scan, por ejemplo), el sistema:
  - **Conserva la hora original** (no se pierde ni se sobreescribe).
  - Crea una **corrección** con la hora nueva y el motivo.
  - Guarda un **registro de auditoría** con: quién hizo la corrección, cuándo, por qué, y desde qué dirección de internet.

### Cómo se cumple (inmutabilidad)
El sistema aplica el principio de **"registro inalterable"**:
- La hora original queda siempre disponible para auditoría.
- Cualquier corrección queda documentada con la identidad del administrador que la hizo.
- Existe una **bitácora de auditoría** completa, consultable en la pantalla "Auditoría", donde se ven todos los cambios con fecha, hora, usuario y dirección IP.

---

## 7. Reconocimiento del trabajador (firma/constancia del registro)

### Qué dice la ley
La NOM-037-STPS-2023 y el espíritu de la reforma LFT 2027 exigen que el trabajador pueda **verificar y reconocer** los registros de su jornada, para que no haya discrepancias entre lo que el patrón reporta y lo que el trabajador vivió.

### Qué hace el sistema
- Cada trabajador puede **ver su propio historial** de entradas y salidas desde su pantalla de empleado ("Mi historial").
- El trabajador puede **exportar** sus propios registros a PDF o Excel cuando lo necesite (sin pedir permiso al patrón).
- Existe un campo de **firma/acknowledgment del empleado** (constancia digital) que registra cuándo el trabajador revisó sus horas.

### Cómo se cumple
El trabajador tiene **acceso directo y permanente** a sus registros, sin intermediarios. Esto garantiza transparencia y permite que el trabajador detecte discrepancias a tiempo.

---

## 8. Alertas NOM-035 (riesgos psicosociales por exceso de horas)

### Qué dice la ley
La **NOM-035-STPS-2018** obliga a identificar factores de riesgo psicosocial en el trabajo, entre ellos las **jornadas de trabajo excesivas**. Un trabajador que sistemáticamente excede las horas extra permitidas está en riesgo psicosocial, y el patrón debe identificarlo y actuar.

### Qué hace el sistema
El sistema genera **alertas automáticas** en cuatro situaciones:
1. **Exceso de horas extra semanales:** si el trabajador supera las 9 horas extra en la semana (tope 2027).
2. **Exceso de horas extra diarias:** si el trabajador hace muchas horas extra en un solo día.
3. **Días largos consecutivos:** si el trabajador tiene varios días seguidos con jornadas muy largas.
4. **Sin día de descanso:** si el trabajador trabajó todos los días de la semana sin descanso.

Las alertas se clasifican en tres niveles de severidad:
- **Alta** (roja): requiere atención inmediata.
- **Media** (ámbar): requiere seguimiento.
- **Baja** (verde): informativa.

### Cómo se cumple la NOM-035
El sistema **identifica automáticamente** los casos de riesgo psicosocial por exceso de horas y los muestra en una pantalla dedicada ("Alertas NOM-035") con:
- El nombre del trabajador.
- El tipo de alerta.
- Una **recomendación** de acción.
- La **referencia legal** aplicable.

Además, una **campana de notificaciones** en la pantalla principal del administrador muestra cuántas alertas hay activas, con un contador en rojo si hay alertas altas.

---

## 9. Geolocalización (registro desde el lugar correcto)

### Qué dice la ley
La **NOM-037-STPS-2023** exige que, en modalidad de teletrabajo o trabajo a distancia, se pueda **verificar la ubicación** desde donde el trabajador registra su asistencia, para acreditar que efectivamente está trabajando desde el lugar convenido.

### Qué hace el sistema
- Cada sucursal o centro de trabajo tiene configurada una **ubicación GPS** (latitud y longitud) y un **radio de tolerancia** (por ejemplo, 100 metros).
- Cuando el trabajador registra entrada/salida desde el terminal o desde su app, el sistema captura su **ubicación GPS** en ese momento.
- Si el trabajador está **fuera del radio permitido**, el sistema lo marca como "ubicación no validada" y lo reporta al administrador.
- El registro **no se bloquea** (el trabajador sí puede registrarse), pero queda la **evidencia de la ubicación** para revisión posterior.

### Cómo se cumple la NOM-037
El sistema guarda, junto con cada registro de asistencia:
- La **coordenada GPS** desde donde se hizo el registro.
- El estado de validación ("Validada" si está dentro del radio, "No validada" si está fuera).
- La distancia a la sucursal.

Esto permite a la empresa demostrar, ante una auditoría, que el trabajador estaba (o no) en el lugar correcto al registrar su asistencia.

---

## 10. Autenticación segura (quién es quién)

### Qué dice la ley
El espíritu de la reforma LFT 2027 es que los registros de asistencia sean **veraces y atribuibles a la persona correcta**. Si cualquier persona pudiera registrar asistencia a nombre de otra, el registro carecería de valor legal.

### Qué hace el sistema
Cada usuario accede con:
1. **Correo electrónico y contraseña** (la contraseña se almacena encriptada, no se ve ni siquiera los administradores).
2. **Verificación en dos pasos (MFA)** opcional: un código adicional generado por una app autenticadora (como Google Authenticator) en el teléfono del usuario.
3. **Código QR personal**: cada empleado tiene un QR único que solo él puede escanear desde su app.

### Medidas de seguridad técnicas
- Las contraseñas **nunca se ven** ni se envían en texto plano.
- Al crear un empleado, el sistema pide **confirmar la contraseña** (escribirla dos veces) y permite **mostrarla/ocultarla** con un botón de "ojo", para evitar errores de captura.
- Las sesiones se cierran automáticamente por inactividad.
- Las "cookies" de sesión están protegidas (no accesibles por scripts maliciosos).

### Cómo se cumple
El sistema garantiza que **cada registro se atribuye a la persona correcta**, mediante:
- Identificación única por empleado (correo + contraseña + QR personal).
- Opción de doble factor (MFA) para administradores.
- Bitácora de auditoría que registra qué usuario hizo cada acción.

---

## 11. Soporte multi-sucursal

### Qué dice la ley
El art. 132 LFT y la NOM-037 exigen que el patrón lleve el control de asistencia **por centro de trabajo**. Una empresa con varias sucursales debe poder distinguir en qué sucursal trabajó cada empleado.

### Qué hace el sistema
- La empresa puede dar de alta **varias sucursales**, cada una con:
  - Nombre y código de local.
  - Dirección.
  - Ubicación GPS y radio de geocerca.
  - Configuración propia de tolerancia de comida, descanso, etc.
- Cada empleado pertenece a **una sucursal**.
- Los **administradores generales** ven y administran todas las sucursales.
- Los **administradores de sucursal** solo ven y administran su propia sucursal.
- Se puede **transferir** un empleado de una sucursal a otra (con registro en la bitácora).

### Cómo se cumple
Cada registro de asistencia queda asociado a la sucursal del trabajador, permitiendo reportes por sucursal y cumplimiento del control "por centro de trabajo" que exige la ley.

---

## 12. Reportes exportables (para nómina y autoridad)

### Qué dice la ley
El art. 804 LFT exige que los registros estén **disponibles para consulta** del trabajador y de la autoridad laboral. Para fines de nómina, el patrón necesita resúmenes por periodo.

### Qué hace el sistema
- Desde la pantalla "Reportes" se pueden generar reportes por:
  - Rango de fechas (hasta 366 días).
  - Empleado específico o todos.
  - Sucursal específica o todas.
- Los reportes incluyen: entradas, salidas, horas trabajadas, horas extra dobles, horas extra triples, días de descanso trabajados, faltas.
- Formatos de exportación:
  - **PDF** (para imprimir o entregar a la autoridad).
  - **Excel/CSV** (para integrar con nómina).
- El trabajador también puede **exportar su propio reporte** desde su pantalla.

### Cómo se cumple el art. 804 LFT
Los registros están disponibles en formato consultable e imprimible, excediendo el mínimo de 12 meses de retención, y pueden entregarse al trabajador o a la autoridad laboral bajo demanda.

---

## 13. Bitácora de auditoría (trazabilidad total)

### Qué dice la ley
El espíritu de la reforma LFT 2027 y de la NOM-035 exige que las acciones del patrón y de los administradores **sean rastreables**, para evitar abusos y permitir investigaciones.

### Qué hace el sistema
- Cada acción importante queda registrada en una **bitácora de auditoría**:
  - Creación, edición y desactivación de empleados.
  - Transferencias entre sucursales.
  - Correcciones de registros de asistencia.
  - Aprobación o rechazo de vacaciones.
  - Cambios de contraseña y desbloqueos de cuenta.
  - Inicios y cierres de sesión.
  - Alertas NOM-035 generadas.
- Cada entrada de la bitácora incluye: **usuario, fecha y hora, dirección IP, tipo de acción y detalle**.

### Cómo se cumple
La pantalla "Auditoría" permite consultar el historial completo de acciones, filtrar por tipo, usuario o fecha. Esto cumple el requisito de trazabilidad y permite investigaciones internas o de la autoridad.

---

## Tabla resumen: función del sistema → artículo de ley

| # | Función del sistema | Artículo de ley | Cómo se cumple |
|---|---------------------|-----------------|----------------|
| 1 | Registro electrónico de entrada/salida/comida | Art. 132, fr. XXXIV LFT (Reforma 2027) | Cada registro se captura con hora exacta, no editable por el trabajador |
| 2 | Conservación de registros +12 meses | Art. 804 LFT | Base de datos permanente; consulta y exportación hasta 366 días por reporte |
| 3 | Asignación manual de horario semanal | Art. 61 LFT | El patrón define día a día si trabaja, descansa o no labora, con horas |
| 4 | Cálculo automático de horas extra dobles | Art. 66 LFT | Las primeras 9 h extra/semana se calculan y reportan al doble |
| 5 | Cálculo automático de horas extra triples | Arts. 67 y 68 LFT | Las horas extra que excedan 9/semana se calculan y reportan al triple |
| 6 | Tope de 9 horas extra semanales (2027) | Transitorio Cuarto DOF 1-may-2026 | Alerta automática si se excede el tope |
| 7 | Día de descanso semanal obligatorio | Art. 69 y 71 LFT | El sistema bloquea el alta/edición si no hay día de descanso marcado |
| 8 | Detección de trabajo en día de descanso + cálculo de prima del 100% | Art. 73 LFT (prima del 100%) y Art. 71 LFT (prima dominical) | El sistema detecta registros en días marcados como descanso, calcula `restDayPremiumMinutes` (prima del 100%), marca `isSunday`, y genera alerta NOM-035 `REST_DAY_WORKED`. Los reportes incluyen columnas separadas para el cálculo de nómina. |
| 9 | Registros inalterables | Espíritu NOM-037 y Reforma LFT 2027 | Hora original bloqueada; correcciones dejan rastro en auditoría |
| 10 | Acceso del trabajador a sus registros | Art. 804 LFT + NOM-037 | El empleado ve y exporta su historial sin intermediarios |
| 11 | Alertas por exceso de horas | NOM-035-STPS-2018 | Alertas automáticas (alta/media/baja) con recomendación y referencia legal |
| 12 | Geolocalización del registro | NOM-037-STPS-2023 | GPS capturado en cada registro; validación contra radio de sucursal |
| 13 | Autenticación segura del usuario | Espíritu Reforma LFT 2027 | Correo + contraseña encriptada + MFA opcional + QR personal |
| 14 | Confirmación de contraseña al alta | Buena práctica de seguridad | Campo de confirmación + botón mostrar/ocultar |
| 15 | Control multi-sucursal | Art. 132 LFT + NOM-037 | Sucursales con GPS propio; empleados asignados a una sucursal |
| 16 | Reportes exportables PDF/Excel | Art. 804 LFT | Reportes por rango, empleado, sucursal; formatos PDF y Excel |
| 17 | Bitácora de auditoría | Espíritu NOM-035 + Reforma LFT 2027 | Trazabilidad de acciones con usuario, IP, fecha y detalle |
| 18 | Registro de vacaciones y permisos | Art. 76 LFT (vacaciones) | Solicitudes, aprobaciones y saldo de días registrados |
| 19 | Códigos de respaldo MFA | Buena práctica de seguridad | Códigos de un solo uso si se pierde el teléfono |

---

## Glosario de términos (para no programadores)

- **GPS:** Sistema de posicionamiento que indica en qué lugar físico (latitud/longitud) se encuentra un dispositivo.
- **QR:** Código de barras cuadrado que, al escanearse con la cámara, identifica a una persona o acción.
- **MFA (autenticación en dos pasos):** Medida de seguridad que pide, además de la contraseña, un código del teléfono.
- **Cookie:** Pequeño archivo que el sistema guarda en el navegador para recordar quién inició sesión.
- **Bitácora de auditoría:** Registro chronological de todas las acciones importantes, con quién, cuándo y desde dónde.
- **Horas extra dobles:** Las primeras 9 horas extra de la semana, pagadas al doble del salario ordinario.
- **Horas extra triples:** Las horas extra que exceden de 9 a la semana, pagadas al triple.
- **NOM:** Norma Oficial Mexicana. NOM-037 regula el trabajo a distancia; NOM-035 regula los riesgos psicosocial.
- **LFT:** Ley Federal del Trabajo.
- **DOF:** Diario Oficial de la Federación, donde se publican las leyes en México.

---

## Conclusión

El sistema **Control de Asistencia v2.2** está diseñado para cumplir de forma integral con la **Reforma a la Ley Federal del Trabajo que entra en vigor el 1 de enero de 2027**, así como con las normas **NOM-037-STPS-2023** y **NOM-035-STPS-2018**.

Cada función del sistema está alineada con un artículo específico de la ley, y el sistema **obliga** al cumplimiento en los puntos críticos (como el día de descanso obligatorio y el tope de horas extra), de modo que no es posible "saltarse" la ley por error u omisión.

Para cualquier duda sobre el cumplimiento específico de un artículo, consulte la tabla resumen de la sección anterior.

---

*Documento generado para el sistema Control de Asistencia v2.2.*
*Última actualización: Junio 2026.*
