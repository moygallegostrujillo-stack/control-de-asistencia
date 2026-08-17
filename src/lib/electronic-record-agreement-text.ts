// ============================================================
// src/lib/electronic-record-agreement-text.ts
//
// RT-P0.5 — Acuerdo formal de Registro Electrónico de Jornada
// (art. 132 fracción XXXIV LFT, reformado por Decreto DOF 27-dic-2024)
//
// El art. 132 XXXIV LFT establece que el registro electrónico de
// jornada "hará prueba plena si se acredita que fue acordado entre
// la persona trabajadora y empleadora". Este archivo contiene el
// texto legal del acuerdo, las versiones y los helpers para llenar
// los placeholders (razón social, RFC, domicilio) y para calcular
// el hash SHA-256 del documento aceptado (evidencia probatoria).
//
// IMPORTANTE: Este acuerdo NO es equivalente al Aviso de Privacidad
// (LFPDPPP art. 16-17). Es un convenio laboral específico sobre el
// sistema de registro electrónico de asistencia.
// ============================================================

import { createHash } from 'crypto';

/**
 * Versión vigente del acuerdo.
 *
 * Incrementar (ej. "1.0" → "1.1") cada vez que el texto del acuerdo
 * sea modificado materialmente. Esto fuerza la re-aceptación de todos
 * los empleados al próximo intento de check-in (la tabla
 * ElectronicRecordAgreement se consulta con `isActive=true` y
 * `agreementVersion = ELECTRONIC_RECORD_AGREEMENT_VERSION`).
 */
export const ELECTRONIC_RECORD_AGREEMENT_VERSION = '1.0';

/**
 * Texto legal del acuerdo. Contiene placeholders que se rellenan
 * en tiempo de ejecución con los datos de la empresa (tabla Company):
 *   {RAZON_SOCIAL}    — razón social de la empresa
 *   {RFC}             — Registro Federal de Contribuyentes
 *   {DOMICILIO}       — domicilio fiscal
 *
 * El texto debe ser profesional y jurídicamente válido para que el
 * registro electrónico haga prueba plena ante una autoridad laboral
 * (Junta de Conciliación y Arbitraje / Tribunales del Trabajo).
 */
export const ELECTRONIC_RECORD_AGREEMENT_TEXT = `ACUERDO DE REGISTRO ELECTRÓNICO DE JORNADA DE TRABAJO
(Acuerdo formal entre empleador y persona trabajadora)

Fundamento legal:
- Ley Federal del Trabajo (LFT), artículo 132, fracción XXXIV, reformado por Decreto publicado en el Diario Oficial de la Federación el 27 de diciembre de 2024.
- Ley Federal del Trabajo, artículos 58 (jornada de trabajo), 59 (distribución de la jornada), 60 (tipos de jornada), 61 (duración máxima), 66 y 68 (tiempo extraordinario) y 804 (obligaciones del patrón de conservar registros).
- Norma Oficial Mexicana NOM-035-STPS-2018, factores de riesgo psicosocial en el trabajo.
- Norma Oficial Mexicana NOM-037-STPS-2023, teletrabajo (cuando aplique).

DATOS DE LA EMPRESA (PARTE EMPLEADORA):
- Razón social: {RAZON_SOCIAL}
- RFC: {RFC}
- Domicilio fiscal: {DOMICILIO}

CLÁUSULAS DEL ACUERDO:

PRIMERA. Objeto. Las partes acuerdan que el registro de la jornada diaria de trabajo (hora de entrada, hora de salida, descansos intra-jornada y, en su caso, tiempo extraordinario) se realizará de manera electrónica mediante el sistema de control de asistencia de la empresa, en sustitución o complemento del registro manual. Este acuerdo se celebra conforme al artículo 132, fracción XXXIV de la Ley Federal del Trabajo, reformado por Decreto publicado en el Diario Oficial de la Federación el 27 de diciembre de 2024.

SEGUNDA. Medio y mecanismo. El registro electrónico se efectuará a través de la aplicación web o móvil designada por la empresa, mediante (i) geolocalización del dispositivo del trabajador (GPS), o (ii) lectura de un código QR dinámico exhibido en el centro de trabajo. En ambos casos, el sistema registrará la fecha, hora exacta (con zona horaria del centro de trabajo), ubicación geográfica (latitud/longitud, cuando aplique), dirección IP y User-Agent del dispositivo utilizado, así como el método empleado.

TERCERA. Validez probatoria. Conforme al artículo 132, fracción XXXIV de la LFT, las partes acuerdan expresamente que el registro electrónico de jornada generado por este sistema hará prueba plena entre las partes respecto del cumplimiento de la jornada de trabajo, entradas, salidas y tiempos extraordinarios, en términos del párrafo tercero del propio precepto legal. El registro electrónico tendrá el mismo valor probatorio que un documento privado suscrito por las partes, salvo prueba en contrario que demuestre alteración o manipulación del sistema.

CUARTA. Derechos de la persona trabajadora. La persona trabajadora tiene derecho a:
   a) Acceder en cualquier momento a sus propios registros de asistencia, a través del sistema, previa autenticación con su usuario y contraseña;
   b) Solicitar al empleador copia de sus registros de asistencia electrónicos por el periodo que marque la ley (mínimo 12 meses, conforme al artículo 804, fracción II de la LFT);
   c) Solicitar la corrección de un registro inexacto cuando exista causa justificada (falla técnica, error del sistema, registro ejecutado por un tercero sin consentimiento), mediante el procedimiento interno de la empresa;
   d) Ejercer los derechos ARCO (acceso, rectificación, cancelación y oposición) previstos en la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) sobre los datos personales recabados;
   e) Reportar de inmediato cualquier anomalía, falla técnica o intento de uso indebido del sistema.

QUINTA. Obligaciones de la empresa. La empresa se obliga a:
   a) Conservar los registros electrónicos de jornada por un mínimo de 12 meses, en términos del artículo 804, fracción II de la LFT;
   b) Garantizar la integridad, confidencialidad y disponibilidad de los registros, mediante Bitácora de Auditoría con encadenamiento de hashes (tamper-evident) y copias de respaldo;
   c) No alterar, modificar ni borrar los registros electrónicos una vez generados; cualquier corrección deberá documentarse con motivo, fecha, identidad de quien la realiza y conservación del valor original;
   d) Proporcionar a la persona trabajadora, a su solicitud, copia de sus registros en un plazo no mayor a 10 días hábiles;
   e) Adoptar las medidas técnicas y administrativas necesarias para prevenir factores de riesgo psicosocial en el trabajo, conforme a la NOM-035-STPS-2018, considerando la información derivada del registro de jornada.

SEXTA. Protección de datos personales. Los datos personales recabados a través del sistema de registro electrónico (ubicación geográfica, dirección IP, dispositivo) serán tratados conforme al Aviso de Privacidad de la empresa y a la LFPDPPP. Los datos de geolocalización se utilizarán únicamente para validar la presencia del trabajador en el centro de trabajo al momento del registro, y no constituyen un sistema de geolocalización permanente ni de vigilancia fuera del horario laboral. La empresa no utilizará el sistema para monitorear la actividad del trabajador fuera del centro de trabajo.

SÉPTIMA. Confidencialidad y seguridad. El acceso a los registros electrónicos estará restringido a: (i) la propia persona trabajadora respecto de sus registros; (ii) el personal autorizado de Recursos Humanos y Nómina; (iii) los supervisores y administradores del centro de trabajo al que pertenece el trabajador; y (iv) las autoridades laborales cuando así lo soliciten en ejercicio de sus facultades de inspección. La empresa mantendrá una bitácora de accesos a los registros.

OCTAVA. Vigencia y modificación. El presente acuerdo entra en vigor en el momento de su aceptación electrónica por la persona trabajadora, y permanecerá vigente durante toda la relación laboral. Si la empresa modifica materialmente el texto del acuerdo (cambio de versión), se requerirá nueva aceptación de la persona trabajadora. Mientras no se obtenga la nueva aceptación, los registros electrónicos generados con la versión anterior conservarán su pleno valor probatorio, pero no se permitirá el registro de nuevos eventos hasta aceptar la versión vigente.

NOVENA. Revocación. La persona trabajadora podrá revocar su consentimiento únicamente cuando medie causa justificada (por ejemplo, terminación de la relación laboral). La revocación no afecta la validez probatoria de los registros generados durante la vigencia del acuerdo.

DÉCIMA. Jurisdicción. Para la interpretación y cumplimiento del presente acuerdo, las partes se someten a la jurisdicción de los Tribunales del Trabajo competentes conforme al artículo 687 y siguientes de la LFT.

ACEPTACIÓN ELECTRÓNICA:
La persona trabajadora manifiesta su conformidad con el presente acuerdo mediante la acción de marcar la casilla "He leído y estoy de acuerdo" y presionar el botón "Aceptar" en la interfaz del sistema. Esta acción constituye su consentimiento expreso, informado y libre, en términos del artículo 132, fracción XXXIV de la LFT y del artículo 17 de la LFPDPPP. El sistema registrará la fecha y hora de aceptación, la dirección IP del dispositivo y el User-Agent del navegador como evidencia probatoria, así como el hash SHA-256 del texto íntegro del acuerdo aceptado.

Versión del acuerdo: ${ELECTRONIC_RECORD_AGREEMENT_VERSION}`;

/**
 * Llena los placeholders {RAZON_SOCIAL}, {RFC} y {DOMICILIO} con
 * los datos de la empresa. Si algún dato falta (p.ej. domicilioFiscal
 * es null), se coloca un texto descriptivo en su lugar para que el
 * documento tenga siempre los campos completos.
 */
export function getAgreementText(company: {
  razonSocial: string;
  rfc: string;
  domicilioFiscal: string | null;
}): string {
  const domicilio = company.domicilioFiscal?.trim() || 'No especificado en el registro de la empresa';
  return ELECTRONIC_RECORD_AGREEMENT_TEXT
    .replaceAll('{RAZON_SOCIAL}', company.razonSocial || 'No especificado')
    .replaceAll('{RFC}', company.rfc || 'No especificado')
    .replaceAll('{DOMICILIO}', domicilio);
}

/**
 * Calcula el hash SHA-256 del texto del acuerdo aceptado.
 * Se almacena en `ElectronicRecordAgreement.documentHash` como
 * evidencia probatoria: permite verificar que el texto que el
 * empleado aceptó corresponde exactamente al texto vigente.
 */
export function computeAgreementHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
