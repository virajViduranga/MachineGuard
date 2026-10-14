import express from 'express';
import cors from 'cors';
import predictionRoutes from './routes/prediction.routes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'MachineGuard API',
  });
});

app.use('/api/predictions', predictionRoutes);

// Handle unknown routes.
app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'The requested endpoint does not exist.',
  });
});

// Centralized error handler.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;

  if (statusCode === 500) {
    console.error('Unexpected API error:', error);
  }

  return res.status(statusCode).json({
    error:
      statusCode === 504
        ? 'ML_SERVICE_TIMEOUT'
        : statusCode === 502
          ? 'ML_SERVICE_ERROR'
          : 'INTERNAL_SERVER_ERROR',
    message:
      statusCode === 504
        ? 'The prediction service took too long to respond.'
        : statusCode === 502
          ? 'The prediction service is currently unavailable.'
          : 'An unexpected server error occurred.',
  });
});

export default app;