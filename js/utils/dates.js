export function formatDate(
  value,
  options = { day: "numeric", month: "long", year: "numeric" },
) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
      ...options,
      timeZone: "America/Sao_Paulo",
    }).format(new Date(`${value.slice(0, 10)}T12:00:00-03:00`))
    : "";
}
export function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
