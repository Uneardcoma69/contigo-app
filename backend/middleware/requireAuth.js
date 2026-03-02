import jwt from "jsonwebtoken";

export default function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Sesión requerida. Por favor inicia sesión." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch (err) {
    const msg = err.name === "TokenExpiredError"
      ? "Tu sesión expiró. Vuelve a iniciar sesión."
      : "Token inválido. Por favor inicia sesión de nuevo.";
    return res.status(401).json({ message: msg });
  }
}
