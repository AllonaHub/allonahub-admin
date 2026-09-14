export function assertActivePartnerBusiness(business) {
  if (!business) {
    const error = new Error("Aktif partner işletme kaydı bulunamadı.");
    error.statusCode = 403;
    throw error;
  }
  if (String(business.status || "").trim().toLowerCase() !== "active") {
    const error = new Error("Partner işletme hesabı aktif değil.");
    error.statusCode = 403;
    throw error;
  }
  return business;
}
