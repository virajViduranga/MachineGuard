import { Router } from 'express';
import { predictMachineFailure } from '../services/ml.service.js';

const router = Router();

const requiredFields = [
  'machine_type',
  'air_temperature_k',
  'process_temperature_k',
  'rotational_speed_rpm',
  'torque_nm',
  'tool_wear_min',
];

function validateReading(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object.';
  }

  const missingFields = requiredFields.filter(
    (field) => !Object.hasOwn(body, field)
  );

  if (missingFields.length > 0) {
    return `Missing fields: ${missingFields.join(', ')}`;
  }

  if (!['L', 'M', 'H'].includes(body.machine_type)) {
    return 'machine_type must be L, M, or H.';
  }

  const numericRules = {
    air_temperature_k: [0, 1000],
    process_temperature_k: [0, 1000],
    rotational_speed_rpm: [0, 100000],
    torque_nm: [-1, 10000],
    tool_wear_min: [-1, 100000],
  };

  for (const [field, [minimum, maximum]] of Object.entries(numericRules)) {
    const value = body[field];

    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= minimum ||
      value > maximum
    ) {
      // Torque and tool wear allow zero.
      if (
        ['torque_nm', 'tool_wear_min'].includes(field) &&
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= maximum
      ) {
        continue;
      }

      return `${field} must be a valid number within the accepted range.`;
    }
  }

  return null;
}

router.post('/', async (req, res, next) => {
  const validationError = validateReading(req.body);

  if (validationError) {
    return res.status(400).json({
      error: 'INVALID_MACHINE_READING',
      message: validationError,
    });
  }

  try {
    const prediction = await predictMachineFailure(req.body);

    return res.status(200).json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    next(error);
  }
});

export default router;