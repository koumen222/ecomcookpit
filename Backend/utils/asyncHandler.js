/**
 * Async Error Handler Utility
 * 
 * Wraps async route handlers to catch errors and pass to Express error middleware.
 * Eliminates need for try-catch in every controller.
 * 
 * Usage:
 * router.get('/path', asyncHandler(async (req, res) => {
 *   // Your async code
 * }));
 */

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
