import { signEmailToken, getClientSlugForEmail } from "../lib/assistant/clientAuth";

// Solo lectura/cómputo — no escribe nada. El token sale de una HMAC
// determinística (mismo email → mismo token siempre), así que esto no
// "crea" nada nuevo en la base: solo calcula el valor que hay que pegar
// como campo estático en Softr (ver el comentario de clientAuth.ts).
async function main() {
  const email = process.argv[2];
  const basePath = process.argv[3] || "/reportes/prensa/secure";
  if (!email) {
    console.error("Uso: tsx scripts/mint-identity-link.ts <email> [basePath]");
    process.exit(1);
  }
  const token = signEmailToken(email);
  const client = await getClientSlugForEmail(email);
  console.log("email:", email);
  console.log("cliente resuelto (client_users):", client ?? "(sin fila en client_users)");
  console.log("token:", token);
  console.log("query:", `?u=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`);
  console.log("path completo:", `${basePath}?u=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
