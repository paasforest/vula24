/**
 * Canonical list of job / pricing service types.
 * Must match `enum ServiceType` in prisma/schema.prisma and customer job routes.
 */
const SERVICE_TYPES = [
  'CAR_LOCKOUT',
  'HOUSE_LOCKOUT',
  'OFFICE_LOCKOUT',
  'KEY_DUPLICATION',
  'CAR_KEY_PROGRAMMING',
  'CAR_KEY_CUTTING',
  'BROKEN_KEY_EXTRACTION',
  'LOST_KEY_REPLACEMENT',
  'IGNITION_REPAIR',
  'LOCK_REPLACEMENT',
  'LOCK_REPAIR',
  'LOCK_UPGRADE',
  'DEADLOCK_INSTALLATION',
  'SAFE_OPENING',
  'GATE_MOTOR_REPAIR',
  'ACCESS_CONTROL',
  'PADLOCK_REMOVAL',
  'GARAGE_DOOR',
  'SECURITY_GATE',
  'ELECTRIC_FENCE_GATE',
];

module.exports = { SERVICE_TYPES };
