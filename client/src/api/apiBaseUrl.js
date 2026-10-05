const DEFAULT_API_URL = "http://localhost:5000/api";

export function resolveApiBaseUrl(configuredUrl) {
  const baseUrl = (configuredUrl || DEFAULT_API_URL).replace(/\/+$/, "");
  return /\/api$/i.test(baseUrl) ? baseUrl : `${baseUrl}/api`;
}
