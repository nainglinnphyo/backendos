try {
  process.loadEnvFile();
} catch {
  // no .env file present - assume BACKENDOS_ACCESS_KEY is set another way (shell export, CI, etc.)
}

import { createBackendOS } from "../backendos-types.js";

if (!process.env.BACKENDOS_ACCESS_KEY) {
  console.error("Missing BACKENDOS_ACCESS_KEY. Copy .env.example to .env and fill in a real key from the dashboard.");
  process.exit(1);
}

const backendos = createBackendOS({
  url: "http://localhost:8787/p/proj1",
  accessKey: process.env.BACKENDOS_ACCESS_KEY,
});

async function main() {
  console.log("create: a new user");
  const user = await backendos.users.create({
    data: { name: "Naing", email: `naing+${Date.now()}@example.com`, age: 30 },
  });
  console.log(user, "\n");

  console.log("create: a post for that user");
  const post = await backendos.posts.create({
    data: { userId: user.id, title: "Hello BackendOS", content: "Posted from a plain Node.js script." },
  });
  console.log(post, "\n");

  console.log("findMany: adults, newest first, limit 20");
  const adults = await backendos.users.findMany({
    where: { age: { gte: 18 } },
    orderBy: { createdAt: "desc" },
    limit: 20,
  });
  console.log(adults, "\n");

  console.log("findUnique: by email");
  const found = await backendos.users.findUnique({ where: { email: user.email } });
  console.log(found, "\n");

  console.log("findMany: field selection (only id + name come back)");
  const idsAndNames = await backendos.users.findMany({ select: ["id", "name"] });
  console.log(idsAndNames, "\n");

  console.log("update: happy birthday");
  const [updated] = await backendos.users.update({ where: { id: user.id }, data: { age: 31 } });
  console.log(updated, "\n");

  console.log("count: total users");
  console.log(await backendos.users.count(), "\n");

  console.log("cleanup: delete the post, then the user");
  await backendos.posts.delete({ where: { id: post.id } });
  await backendos.users.delete({ where: { id: user.id } });
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
