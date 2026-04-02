/**
 * Tests for the RepoProfiler.
 *
 * Uses temporary directories mimicking real project structures to
 * verify framework detection, signal scoring, and profile generation.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectFramework, profileRepository } from "../../src/repo/RepoProfiler.js";

describe("RepoProfiler", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `barwise-profiler-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  /** Helper: create a file with content. */
  function createFile(relativePath: string, content = "// placeholder"): void {
    const fullPath = join(testDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content);
  }

  describe("detectFramework", () => {
    it("returns null for empty directory", () => {
      expect(detectFramework(testDir, "unknown")).toBeNull();
    });

    it("returns null for unrecognized language", () => {
      createFile("src/main.rs", "fn main() {}");
      expect(detectFramework(testDir, "unknown")).toBeNull();
    });

    it("detects Spring Boot with high confidence", () => {
      // Strong: spring-boot dependency + application.yml
      createFile(
        "build.gradle.kts",
        `dependencies {
  implementation("org.springframework.boot:spring-boot-starter-web")
}`,
      );
      createFile("src/main/java/com/example/application.yml", "server:\n  port: 8080");
      // Moderate: @SpringBootApplication annotation
      createFile(
        "src/main/java/com/example/App.java",
        `@SpringBootApplication
public class App { public static void main(String[] args) {} }`,
      );

      const result = detectFramework(testDir, "java");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Spring Boot");
      expect(result!.confidence).toBe("high");
      expect(result!.signals.length).toBeGreaterThanOrEqual(3);
    });

    it("detects Spring Boot with Kotlin", () => {
      createFile(
        "build.gradle.kts",
        `dependencies {
  implementation("org.springframework.boot:spring-boot-starter-web")
}`,
      );
      createFile("src/main/kotlin/com/example/application.yml", "server:\n  port: 8080");
      createFile(
        "src/main/kotlin/com/example/App.kt",
        `@SpringBootApplication
class App`,
      );

      const result = detectFramework(testDir, "kotlin");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Spring Boot");
    });

    it("detects NestJS", () => {
      createFile(
        "package.json",
        JSON.stringify({
          dependencies: { "@nestjs/core": "^10.0.0" },
        }),
      );
      createFile("nest-cli.json", "{}");
      createFile(
        "src/app.module.ts",
        `import { Module } from '@nestjs/common';
@Module({ imports: [] })
export class AppModule {}`,
      );

      const result = detectFramework(testDir, "typescript");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("NestJS");
      expect(result!.confidence).toBe("high");
    });

    it("detects Express", () => {
      createFile(
        "package.json",
        JSON.stringify({
          dependencies: { "express": "^4.18.0" },
        }),
      );
      createFile(
        "src/app.ts",
        `import express from 'express';
const app = express();
app.get('/api/health', (req, res) => res.send('ok'));`,
      );

      const result = detectFramework(testDir, "typescript");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Express");
    });

    it("detects Django", () => {
      createFile("manage.py", "#!/usr/bin/env python\nimport django");
      createFile(
        "requirements.txt",
        "django==4.2\ndjango-rest-framework==3.14",
      );
      createFile(
        "myapp/models.py",
        `from django.db import models

class Order(models.Model):
    status = models.CharField(max_length=20)`,
      );
      createFile("myapp/settings.py", "INSTALLED_APPS = []");

      const result = detectFramework(testDir, "python");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Django");
      expect(result!.confidence).toBe("high");
    });

    it("detects FastAPI", () => {
      createFile(
        "requirements.txt",
        "fastapi==0.100.0\nuvicorn==0.23.0\npydantic==2.0",
      );
      createFile(
        "app/main.py",
        `from fastapi import FastAPI

app = FastAPI()

class Item(BaseModel):
    name: str

@app.get("/items")
def list_items(): pass`,
      );

      const result = detectFramework(testDir, "python");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("FastAPI");
    });

    it("detects Rails", () => {
      createFile("Gemfile", 'source "https://rubygems.org"\ngem "rails", "~> 7.0"');
      createFile("config/routes.rb", "Rails.application.routes.draw do\nend");
      mkdirSync(join(testDir, "app/models"), { recursive: true });
      createFile(
        "app/models/user.rb",
        `class User < ApplicationRecord
  validates :name, presence: true
end`,
      );
      mkdirSync(join(testDir, "app/controllers"), { recursive: true });

      const result = detectFramework(testDir, "ruby");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Rails");
      expect(result!.confidence).toBe("high");
    });

    it("prefers NestJS over Express when both signals present", () => {
      // NestJS apps also use express under the hood
      createFile(
        "package.json",
        JSON.stringify({
          dependencies: {
            "@nestjs/core": "^10.0.0",
            "express": "^4.18.0",
          },
        }),
      );
      createFile("nest-cli.json", "{}");
      createFile(
        "src/app.module.ts",
        `@Module({})
export class AppModule {}`,
      );

      const result = detectFramework(testDir, "typescript");
      expect(result).not.toBeNull();
      // NestJS should score higher due to more specific signals
      expect(result!.name).toBe("NestJS");
    });

    it("only considers detectors matching the language", () => {
      // Set up Spring Boot signals but ask for TypeScript detection
      createFile(
        "build.gradle.kts",
        'implementation("org.springframework.boot:spring-boot-starter-web")',
      );
      createFile("src/main/java/application.yml", "server:\n  port: 8080");

      const result = detectFramework(testDir, "typescript");
      // Should not match Spring Boot since we're asking for TypeScript
      if (result) {
        expect(result.name).not.toBe("Spring Boot");
      }
    });
  });

  describe("profileRepository", () => {
    it("profiles a TypeScript NestJS project", () => {
      createFile(
        "package.json",
        JSON.stringify({
          dependencies: { "@nestjs/core": "^10.0.0" },
        }),
      );
      createFile("nest-cli.json", "{}");
      createFile(
        "src/app.module.ts",
        `@Module({})
export class AppModule {}`,
      );
      createFile("src/users/users.service.ts", "export class UsersService {}");
      createFile("src/users/users.controller.ts", "export class UsersController {}");

      const profile = profileRepository(testDir);

      expect(profile.language).toBe("typescript");
      expect(profile.framework).not.toBeNull();
      expect(profile.framework!.name).toBe("NestJS");
      expect(profile.buildSystem).not.toBeNull();
      expect(profile.buildSystem!.name).toBe("npm");
      expect(profile.sourceFileCount).toBeGreaterThan(0);
      expect(profile.importFormat).toBe("typescript");
      expect(profile.summary).toContain("NestJS");
    });

    it("profiles a Java Spring Boot project", () => {
      createFile(
        "pom.xml",
        `<project>
  <dependencies>
    <dependency>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
</project>`,
      );
      createFile("src/main/java/com/example/application.yml", "server:\n  port: 8080");
      createFile(
        "src/main/java/com/example/App.java",
        "@SpringBootApplication\npublic class App {}",
      );
      createFile(
        "src/main/java/com/example/model/Order.java",
        "@Entity\npublic class Order {}",
      );

      const profile = profileRepository(testDir);

      expect(profile.language).toBe("java");
      expect(profile.framework!.name).toBe("Spring Boot");
      expect(profile.buildSystem!.name).toBe("Maven");
      expect(profile.importFormat).toBe("java");
      expect(profile.summary).toContain("Spring Boot");
      expect(profile.summary).toContain("Maven");
    });

    it("profiles a plain TypeScript project without framework", () => {
      createFile(
        "package.json",
        JSON.stringify({ name: "my-lib" }),
      );
      createFile("src/index.ts", "export const version = '1.0';");
      createFile("src/utils.ts", "export function add(a: number, b: number) { return a + b; }");

      const profile = profileRepository(testDir);

      expect(profile.language).toBe("typescript");
      expect(profile.framework).toBeNull();
      expect(profile.buildSystem!.name).toBe("npm");
      expect(profile.importFormat).toBe("typescript");
      expect(profile.summary).toContain("no framework detected");
    });

    it("profiles a Python project without framework", () => {
      createFile("requirements.txt", "requests==2.31.0");
      createFile("main.py", "import requests");
      createFile("utils.py", "def helper(): pass");

      const profile = profileRepository(testDir);

      expect(profile.language).toBe("python");
      expect(profile.framework).toBeNull();
      expect(profile.importFormat).toBeNull();
      expect(profile.summary).toContain("Python");
      expect(profile.summary).toContain("No dedicated importer");
    });

    it("includes signal details in summary", () => {
      createFile(
        "package.json",
        JSON.stringify({
          dependencies: { "@nestjs/core": "^10.0.0" },
        }),
      );
      createFile("nest-cli.json", "{}");
      createFile("src/app.module.ts", "@Module({}) export class AppModule {}");

      const profile = profileRepository(testDir);

      expect(profile.summary).toContain("Signals:");
    });

    it("excludes paths correctly", () => {
      createFile(
        "package.json",
        JSON.stringify({
          dependencies: { "@nestjs/core": "^10.0.0" },
        }),
      );
      createFile("nest-cli.json", "{}");
      createFile("src/app.module.ts", "@Module({}) export class AppModule {}");
      createFile("src/service.ts", "export class Service {}");

      const profile = profileRepository(testDir);

      expect(profile.excludePaths).toContain("node_modules");
      expect(profile.excludePaths).toContain("dist");
    });

    it("returns 'unknown' language for empty project", () => {
      const profile = profileRepository(testDir);
      expect(profile.language).toBe("unknown");
      expect(profile.framework).toBeNull();
      expect(profile.buildSystem).toBeNull();
    });
  });
});
