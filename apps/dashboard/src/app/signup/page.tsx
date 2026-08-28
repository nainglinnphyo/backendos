import Link from "next/link";
import { signupAction } from "@/lib/auth-actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="brand-mark">
          <span className="brand-mark__logo">B</span>
          BackendOS
        </span>
        <h1>Create your account</h1>
        <p className="muted">Free accounts can create up to 3 projects.</p>

        {error && <p className="error">{error}</p>}

        <form action={signupAction} className="auth-form">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoFocus />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
          <button type="submit">Create account</button>
        </form>

        <p className="switch-link muted">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
