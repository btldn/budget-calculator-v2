import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    // Пул forks пишет временные копии модулей в системный temp и падает там
    // с EBADF при rename (Windows + Node 24); threads держит их в памяти.
    pool: "threads",
  },
});
