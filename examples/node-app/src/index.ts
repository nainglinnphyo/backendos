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
  url: "http://localhost:8787/p/room-chat",
  accessKey: process.env.BACKENDOS_ACCESS_KEY,
});

async function main() {
  console.log("create: a new conversation");
  const convo = await backendos.conversations.create({
    data: { name: `General ${Date.now()}`, userCount: 3 },
  });
  console.log(convo, "\n");

  console.log("findMany: busiest conversations first, limit 20");
  const busiest = await backendos.conversations.findMany({
    where: { userCount: { gte: 1 } },
    orderBy: { userCount: "desc" },
    limit: 20,
  });
  console.log(busiest, "\n");

  console.log("findUnique: by id");
  const found = await backendos.conversations.findUnique({ where: { id: convo.id } });
  console.log(found, "\n");

  console.log("findMany: field selection (only id + name come back)");
  const idsAndNames = await backendos.conversations.findMany({ select: ["id", "name"] });
  console.log(idsAndNames, "\n");

  console.log("update: someone joined");
  const [updated] = await backendos.conversations.update({ where: { id: convo.id }, data: { userCount: 4 } });
  console.log(updated, "\n");

  console.log("count: total conversations");
  console.log(await backendos.conversations.count(), "\n");

  // console.log("cleanup: delete the conversation");
  // await backendos.conversations.delete({ where: { id: convo.id } });
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
