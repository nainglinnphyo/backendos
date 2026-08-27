/** snake_case DB column -> camelCase API/TS field name. "created_at" -> "createdAt". */
export function toCamelCase(name: string): string {
  return name.replace(/_+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** snake_case table name -> PascalCase type prefix. "user_posts" -> "UserPosts". */
export function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}
