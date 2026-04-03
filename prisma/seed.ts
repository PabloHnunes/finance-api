import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createCipheriv, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function encrypt(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD must be set in .env');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@finance.com' },
    update: {
      authProviders: {
        updateMany: {
          where: { provider: 'LOCAL' },
          data: { passwordHash },
        },
      },
    },
    create: {
      email: 'admin@finance.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'Finance',
      cpf: encrypt('00000000000'),
      birthDate: new Date('2000-01-01'),
      street: 'Rua Admin',
      neighborhood: 'Centro',
      state: 'SP',
      city: 'São Paulo',
      number: '1',
      zipCode: '01001000',
      authProviders: {
        create: {
          provider: 'LOCAL',
          passwordHash,
        },
      },
    },
  });

  console.log(`Admin user seeded: ${admin.email} (${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
