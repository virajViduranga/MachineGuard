import 'dotenv/config';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL;

if (!ML_SERVICE_URL) {
  throw new Error('ML_SERVICE_URL is not configured.');
}

export async function predictMachineFailure(reading) {
  let response;

  try {
    response = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      const timeoutError = new Error('ML service timed out.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    const serviceError = new Error('ML service is unavailable.');
    serviceError.statusCode = 502;
    throw serviceError;
  }

  if (!response.ok) {
    const serviceError = new Error('ML service returned an error.');
    serviceError.statusCode = 502;
    throw serviceError;
  }

  return response.json();
}