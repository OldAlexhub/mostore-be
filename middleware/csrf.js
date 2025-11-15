
// CSRF middleware removed. Keep a no-op placeholder so any accidental imports are harmless.
export default function csrfMiddleware(req, res, next) {
  return next();
}
