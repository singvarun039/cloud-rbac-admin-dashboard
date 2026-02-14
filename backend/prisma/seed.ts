import { prisma } from "../src/db/prisma";
import { hashPassword } from "../src/utils/password";

const PERMISSION_KEYS = [
  "users.read",
  "users.write",
  "users.edit",
  "roles.read",
  "roles.write",
  "roles.edit",
  "permissions.read",
  "projects.read",
  "projects.write",
  "projects.edit",
  "audit.read",
] as const;

const VIEWER_PERMISSION_KEYS = [
  "users.read",
  "projects.read",
  "audit.read",
  "roles.read",
  "permissions.read",
] as const;

const EDITOR_PERMISSION_KEYS = [
  "users.read",
  "users.edit",
  "projects.read",
  "projects.edit",
  "audit.read",
  "roles.read",
  "permissions.read",
] as const;

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "rbac_admin@rbac.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "rbac@1234";

  const viewerEmail = process.env.SEED_VIEWER_EMAIL ?? "rbac_viewer@rbac.local";
  const viewerPassword = process.env.SEED_VIEWER_PASSWORD ?? "rbac@1234";

  const editorEmail = process.env.SEED_EDITOR_EMAIL ?? "rbac_editor@rbac.local";
  const editorPassword = process.env.SEED_EDITOR_PASSWORD ?? "rbac@1234";

  const passwordHash = await hashPassword(password);
  const viewerPasswordHash = await hashPassword(viewerPassword);
  const editorPasswordHash = await hashPassword(editorPassword);

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
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  const viewerUser = await prisma.user.upsert({
    where: { email: viewerEmail },
    update: {
      passwordHash: viewerPasswordHash,
      isActive: true,
      firstName: "Viewer",
    },
    create: {
      email: viewerEmail,
      passwordHash: viewerPasswordHash,
      isActive: true,
      firstName: "Viewer",
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  const editorUser = await prisma.user.upsert({
    where: { email: editorEmail },
    update: {
      passwordHash: editorPasswordHash,
      isActive: true,
      firstName: "Editor",
    },
    create: {
      email: editorEmail,
      passwordHash: editorPasswordHash,
      isActive: true,
      firstName: "Editor",
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  const [adminRole, viewerRole, editorRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: "ADMIN" },
      update: { description: "Full system access" },
      create: { name: "ADMIN", description: "Full system access" },
      select: { id: true, name: true },
    }),
    prisma.role.upsert({
      where: { name: "VIEWER" },
      update: { description: "Read-only access" },
      create: { name: "VIEWER", description: "Read-only access" },
      select: { id: true, name: true },
    }),
    prisma.role.upsert({
      where: { name: "EDITOR" },
      update: { description: "Limited write access" },
      create: { name: "EDITOR", description: "Limited write access" },
      select: { id: true, name: true },
    }),
  ]);

  const permissions = await Promise.all(
    PERMISSION_KEYS.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key },
        select: { id: true, key: true },
      }),
    ),
  );

  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({
      roleId: adminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  await prisma.rolePermission.createMany({
    data: permissions
      .filter((p) => VIEWER_PERMISSION_KEYS.includes(p.key as any))
      .map((p) => ({ roleId: viewerRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  await prisma.rolePermission.createMany({
    data: permissions
      .filter((p) => EDITOR_PERMISSION_KEYS.includes(p.key as any))
      .map((p) => ({ roleId: editorRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  await prisma.userRole.createMany({
    data: [{ userId: user.id, roleId: adminRole.id }],
    skipDuplicates: true,
  });

  await prisma.userRole.createMany({
    data: [{ userId: viewerUser.id, roleId: viewerRole.id }],
    skipDuplicates: true,
  });

  await prisma.userRole.createMany({
    data: [{ userId: editorUser.id, roleId: editorRole.id }],
    skipDuplicates: true,
  });

  console.log("Seeded admin user:", user);
  console.log("Seeded viewer user:", viewerUser);
  console.log("Seeded editor user:", editorUser);
  console.log("Seeded roles:", [
    adminRole.name,
    viewerRole.name,
    editorRole.name,
  ]);
  console.log(
    "Seeded permissions:",
    permissions.map((p) => p.key),
  );
  console.log("Assigned ADMIN role to:", user.email);
  console.log("Assigned VIEWER role to:", viewerUser.email);
  console.log("Assigned EDITOR role to:", editorUser.email);
  console.log("Admin login:", { email, password });
  console.log("Viewer login:", {
    email: viewerEmail,
    password: viewerPassword,
  });
  console.log("Editor login:", {
    email: editorEmail,
    password: editorPassword,
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
