/** Chrome + opener. Override at build time (`NEXT_PUBLIC_*` is inlined). */
export function appName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Capveon";
}

export function productName(): string {
  return process.env.NEXT_PUBLIC_PRODUCT?.trim() || "Copilot";
}

export function repName(): string {
  return process.env.NEXT_PUBLIC_REP_NAME?.trim() || "Finn";
}

export function siteTitle(): string {
  return `${appName()} ${productName()}`;
}
