import { prisma } from "../src/db/prisma";
import { hashPassword } from "../src/utils/password";

async function main() {
  const email = "admin@naxverse.local";
  const password = "Admin@12345";

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      isActive: true,
      firstName: "Admin",
    },
    create: {
      email,
      passwordHash,
      isActive: true,
      firstName: "Admin",
    },
    select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
  });

  console.log("✅ Seeded admin user:", user);
  console.log("🔑 Login with:", { email, password });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
