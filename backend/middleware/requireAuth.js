import { verificarSesion } from "./session.js";

export default function requireAuth(req, res, next) {
  try {
    const { userId, user } = verificarSesion(req);
    req.userId = userId;
    req.user = user;
    next();
  } catch (err) {
    return res.status(err.status || 401).json({ message: err.message });
  }
}
