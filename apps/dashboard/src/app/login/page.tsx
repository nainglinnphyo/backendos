import Link from "next/link";
import { loginAction } from "@/lib/auth-actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="brand-mark">
          <span className="brand-mark__logo">B</span>
          BackendOS
        </span>
        <h1>Sign in</h1>
        <p className="muted">Manage your projects, tables, and API keys.</p>

        {error && <p className="error">{error}</p>}

        <form action={loginAction} className="auth-form">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoFocus />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={8} />
          <button type="submit">Sign in</button>
        </form>

        <p className="switch-link muted">
          No account? <Link href="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
