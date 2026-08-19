"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { closeSession, openSession, passwordMatches } from "@/lib/auth";
import { postHumanMessage, setThreadStatus } from "@/lib/admin";

export async function signIn(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    redirect("/admin/login?error=1");
  }
  await openSession();
  redirect("/admin");
}

export async function signOut() {
  await closeSession();
  redirect("/admin/login");
}

export async function takeOver(formData: FormData) {
  const id = String(formData.get("conversationId"));
  await setThreadStatus(id, "human");
  revalidatePath("/admin");
}

export async function handBack(formData: FormData) {
  const id = String(formData.get("conversationId"));
  await setThreadStatus(id, "active");
  revalidatePath("/admin");
}

export async function replyAsHuman(formData: FormData) {
  const id = String(formData.get("conversationId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await setThreadStatus(id, "human");
  await postHumanMessage(id, body);
  revalidatePath("/admin");
}
