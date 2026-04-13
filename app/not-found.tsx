export const dynamic = "force-dynamic"

export default function NotFound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "16px", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Página no encontrada</h2>
      <p style={{ margin: 0, color: "#666" }}>La página que buscás no existe.</p>
      <a href="/" style={{ fontSize: "0.875rem", color: "#000", textDecoration: "underline" }}>
        Volver al inicio
      </a>
    </div>
  )
}
