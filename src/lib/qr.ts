import QRCode from 'qrcode';
import crypto from 'crypto';

// HMAC secret for signing QR tokens
function getQRSecret(): string {
  return process.env.QR_SECRET || 'nom037-qr-signing-secret-2024';
}

// Signed token format: NOM037:<randomHex>:<expiresTimestamp>:<hmacSignature>
// This allows validation without database access (critical for serverless environments)

function createSignedToken(randomHex: string, expiresTimestamp: number): string {
  const data = `${randomHex}:${expiresTimestamp}`;
  const signature = crypto.createHmac('sha256', getQRSecret()).update(data).digest('hex');
  return `NOM037:${randomHex}:${expiresTimestamp}:${signature}`;
}

function verifySignedToken(token: string): { valid: boolean; expired: boolean; code: string | null } {
  try {
    const parts = token.split(':');
    if (parts.length !== 4 || parts[0] !== 'NOM037') {
      return { valid: false, expired: false, code: null };
    }

    const [, randomHex, expiresStr, signature] = parts;
    const expiresTimestamp = parseInt(expiresStr, 10);
    const data = `${randomHex}:${expiresTimestamp}`;
    const expectedSignature = crypto.createHmac('sha256', getQRSecret()).update(data).digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, expired: false, code: null };
    }

    if (Date.now() > expiresTimestamp) {
      return { valid: false, expired: true, code: randomHex };
    }

    return { valid: true, expired: false, code: randomHex };
  } catch {
    return { valid: false, expired: false, code: null };
  }
}

// Generate QR as SVG data URL (works without native canvas module in serverless)
async function qrToSvgDataUrl(text: string, options: { width?: number; margin?: number; color?: { dark: string; light: string } }): Promise<string> {
  const svgString = await QRCode.toString(text, {
    type: 'svg',
    width: options.width || 400,
    margin: options.margin ?? 2,
    color: options.color,
    errorCorrectionLevel: 'M',
  });
  // Convert SVG string to base64 data URL
  const base64 = Buffer.from(svgString).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// Generate a dynamic QR code that expires after a set time
export async function generateDynamicQR(expiryMinutes: number = 5): Promise<{ code: string; qrDataUrl: string; expiresAt: Date }> {
  const randomHex = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  const expiresTimestamp = expiresAt.getTime();

  // Create signed token (works without database)
  const signedToken = createSignedToken(randomHex, expiresTimestamp);

  // Try to store in database (optional, for tracking used codes)
  try {
    const { db } = await import('./db');
    // Clean up expired QR codes
    await db.dynamicQR.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    }).catch(() => {}); // Ignore cleanup errors

    // Create new dynamic QR record
    await db.dynamicQR.create({
      data: { code: signedToken, expiresAt, used: false }
    }).catch(() => {}); // Ignore create errors
  } catch (error) {
    console.warn('DB storage for QR code skipped:', error instanceof Error ? error.message : String(error));
  }

  // Generate QR image as SVG data URL (works in serverless without canvas)
  const qrDataUrl = await qrToSvgDataUrl(signedToken, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });

  return { code: signedToken, qrDataUrl, expiresAt };
}

// Validate a dynamic QR code
export async function validateDynamicQR(code: string): Promise<{ valid: boolean; expired: boolean }> {
  // First, try signed token validation (works without database)
  if (code.startsWith('NOM037:')) {
    const result = verifySignedToken(code);
    if (!result.valid && !result.expired) {
      return { valid: false, expired: false }; // Invalid signature
    }
    if (result.expired) {
      return { valid: false, expired: true };
    }

    // Check if code was already used in database (optional)
    try {
      const { db } = await import('./db');
      const qr = await db.dynamicQR.findUnique({ where: { code } });
      if (qr?.used) {
        return { valid: false, expired: false }; // Already used
      }
    } catch {
      // Database not available, skip used check
    }

    return { valid: true, expired: false };
  }

  // Legacy format: validate using database only
  try {
    const { db } = await import('./db');
    const qr = await db.dynamicQR.findUnique({ where: { code } });

    if (!qr) return { valid: false, expired: false };
    if (qr.used) return { valid: false, expired: false };
    if (qr.expiresAt < new Date()) return { valid: false, expired: true };

    return { valid: true, expired: false };
  } catch (error) {
    console.warn('DB validation failed:', error instanceof Error ? error.message : String(error));
    return { valid: false, expired: false };
  }
}

// Mark a QR code as used
export async function markQRUsed(code: string): Promise<void> {
  try {
    const { db } = await import('./db');
    await db.dynamicQR.update({
      where: { code },
      data: { used: true }
    });
  } catch (error) {
    console.warn('Could not mark QR as used in DB:', error instanceof Error ? error.message : String(error));
    // Not critical - signed token already has expiration
  }
}

// Generate a static employee QR code (for employee identification)
export async function generateEmployeeQR(employeeNumber: string, employeeName: string): Promise<string> {
  const payload = JSON.stringify({
    type: 'EMPLOYEE_ID',
    employeeNumber,
    name: employeeName,
    timestamp: Date.now()
  });
  
  return qrToSvgDataUrl(payload, {
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' }
  });
}
