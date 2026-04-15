import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.emailLog.deleteMany();
  await prisma.emailTemplate.deleteMany();
}

main().finally(() => prisma.$disconnect());
