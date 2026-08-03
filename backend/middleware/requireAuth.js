import jwt from "jsonwebtoken";
import { findUserById } from "../store.js";

export default function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Sesión requerida. Por favor inicia sesión." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = findUserById(payload.id);

    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado." });
    }

    // Si la contraseña cambió después de emitir el token, la sesión ya no vale.
    // Los tokens antiguos (sin "v") se tratan como versión 0 por compatibilidad.
    if ((payload.v ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: "Tu contraseña cambió. Vuelve a iniciar sesión." });
    }

    req.userId = payload.id;
    req.user = user;
    next();
  } catch (err) {
    const msg = err.name === "TokenExpiredError"
      ? "Tu sesión expiró. Vuelve a iniciar sesión."
      : "Token inválido. Por favor inicia sesión de nuevo.";
    return res.status(401).json({ message: msg });
  }
}
