export function generateDid(): string {
  const uuid = crypto.randomUUID();
  return `did:plc:${uuid.replace(/-/g, "")}`;
}

export function generateHandle(email: string): string {
  const username = email.split("@")[0]!.toLowerCase();
  const sanitized = username.replace(/[^a-z0-9]/g, "");
  return `${sanitized}.spec.dev`;
}
