// lib/prisma.ts
import { PrismaClient } from "./generated/prisma/client"

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Chỉ enable log trong development
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}