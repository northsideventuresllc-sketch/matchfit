import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaPgCtor, prismaClientCtor } = vi.hoisted(() => ({
  prismaPgCtor: vi.fn((options: { connectionString: string }) => ({
    kind: "adapter",
    options,
  })),
  prismaClientCtor: vi.fn((options: { adapter: unknown; log: string[] }) => ({
    kind: "client",
    options,
  })),
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: prismaPgCtor,
}));

vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: prismaClientCtor,
}));

import { createPrismaClient } from "@/lib/create-prisma-client";

describe("createPrismaClient", () => {
  beforeEach(() => {
    prismaPgCtor.mockClear();
    prismaClientCtor.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses trimmed DATABASE_URL and production log level by default", () => {
    vi.stubEnv("DATABASE_URL", " postgresql://db-user:db-pass@localhost:5432/matchfit ");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("npm_lifecycle_event", "");
    vi.stubEnv("NODE_ENV", "production");

    createPrismaClient();

    expect(prismaPgCtor).toHaveBeenCalledWith({
      connectionString: "postgresql://db-user:db-pass@localhost:5432/matchfit",
    });
    const adapter = prismaPgCtor.mock.results[0]?.value;
    expect(prismaClientCtor).toHaveBeenCalledWith({
      adapter,
      log: ["error"],
    });
  });

  it("uses placeholder URL during Next production build without DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "   ");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("npm_lifecycle_event", "");

    createPrismaClient();

    expect(prismaPgCtor).toHaveBeenCalledWith({
      connectionString: "postgresql://build:build@127.0.0.1:1/matchfit_build_placeholder",
    });
  });

  it("uses placeholder URL for npm build lifecycle without DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("npm_lifecycle_event", "build");

    createPrismaClient();

    expect(prismaPgCtor).toHaveBeenCalledWith({
      connectionString: "postgresql://build:build@127.0.0.1:1/matchfit_build_placeholder",
    });
  });

  it("uses warn+error logs in development", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://dev:dev@localhost:5432/matchfit");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("npm_lifecycle_event", "");

    createPrismaClient();

    const adapter = prismaPgCtor.mock.results[0]?.value;
    expect(prismaClientCtor).toHaveBeenCalledWith({
      adapter,
      log: ["error", "warn"],
    });
  });

  it("throws a clear error when DATABASE_URL is missing outside build", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("npm_lifecycle_event", "");

    expect(() => createPrismaClient()).toThrowError("DATABASE_URL is required for Prisma.");
    expect(prismaPgCtor).not.toHaveBeenCalled();
    expect(prismaClientCtor).not.toHaveBeenCalled();
  });
});
