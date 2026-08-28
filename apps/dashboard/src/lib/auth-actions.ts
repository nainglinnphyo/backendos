"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./session-cookie";

const API_URL = (process.env.BACKENDOS_API_URL ?? "http://localhost:8787").replace(/\/+$/, "");

async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function signupAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    redirect(`/signup?error=${encodeURIComponent(json?.error?.message ?? "Sign up failed")}`);
  }

  await setSessionCookie(json.data.token, json.data.expiresAt);
  redirect("/");
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    redirect(`/login?error=${encodeURIComponent(json?.error?.message ?? "Sign in failed")}`);
  }

  await setSessionCookie(json.data.token, json.data.expiresAt);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
