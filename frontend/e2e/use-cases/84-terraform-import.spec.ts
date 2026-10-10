/**
 * UC-84: Terraform infrastructure-as-code import (US-12.3, US-16.1)
 *
 * Tests POST /api/threat-models/import/terraform
 * Parses .tf HCL to extract cloud resources as canvas components.
 */
import { test, expect, login, deleteModel, apiPost, apiGet } from "./_fixtures";

const TF_FIXTURE = `
terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = { Name = "main-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
  tags = { Name = "public-subnet" }
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id
  tags = { Name = "web-server" }
}

resource "aws_db_instance" "db" {
  identifier     = "prod-db"
  engine         = "postgres"
  instance_class = "db.t3.micro"
  username       = "admin"
  password       = "CHANGEME"
  tags           = { Name = "prod-db" }
}

resource "aws_s3_bucket" "assets" {
  bucket = "my-assets-bucket"
  tags   = { Name = "assets" }
}

resource "aws_security_group" "web_sg" {
  name   = "web-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
`;

test.describe("UC-84 — Terraform Import", () => {
  const createdModelIds: string[] = [];

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    for (const id of createdModelIds) {
      await deleteModel(page, id).catch(() => {});
    }
    await page.close();
  });

  test("US-12.3: POST /import/terraform creates a model from .tf content", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{
      modelId?: string;
      componentCount?: number;
      warnings?: string[];
    }>(page, "/api/threat-models/import/terraform", {
      content: TF_FIXTURE,
      name: "E2E Terraform Import",
    });

    expect(res.modelId).toBeTruthy();
    expect(res.componentCount).toBeGreaterThanOrEqual(3);
    if (res.modelId) createdModelIds.push(res.modelId);
  });

  test("US-12.3: Terraform canvas nodes map to AWS resource types", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{ modelId?: string }>(
      page,
      "/api/threat-models/import/terraform",
      { content: TF_FIXTURE, name: "E2E TF Canvas Check" },
    );
    if (!res.modelId) {
      test.skip();
      return;
    }
    createdModelIds.push(res.modelId);

    const model = await apiGet<{ canvasState?: string }>(
      page,
      `/api/threat-models/${res.modelId}`,
    );
    const canvas =
      typeof model.canvasState === "string"
        ? JSON.parse(model.canvasState)
        : (model.canvasState ?? {});

    expect(Array.isArray(canvas.nodes)).toBe(true);
    expect(canvas.nodes.length).toBeGreaterThanOrEqual(3);

    // At least one node should reflect an AWS resource type
    const types = (canvas.nodes as Array<{ data?: { type?: string } }>).map(
      (n) => n.data?.type ?? "",
    );
    const hasAwsType = types.some(
      (t) =>
        t.startsWith("AWS_") ||
        t === "DATABASE" ||
        t === "OBJECT_STORAGE" ||
        t === "SERVER",
    );
    expect(hasAwsType).toBe(true);
  });

  test("US-12.3: Terraform import handles empty content gracefully", async ({
    page,
  }) => {
    await login(page);

    const caught = await apiPost(page, "/api/threat-models/import/terraform", {
      content: "",
      name: "Empty TF",
    }).catch((e: Error) => ({ error: e.message }));

    expect((caught as { error?: string }).error).toBeTruthy();
  });

  test("US-12.3: Terraform import model is retrievable via GET", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{ modelId?: string }>(
      page,
      "/api/threat-models/import/terraform",
      { content: TF_FIXTURE, name: "E2E TF Retrieve Check" },
    );
    if (!res.modelId) {
      test.skip();
      return;
    }
    createdModelIds.push(res.modelId);

    const model = await apiGet<{ id: string; name: string }>(
      page,
      `/api/threat-models/${res.modelId}`,
    );
    expect(model.id).toBe(res.modelId);
    expect(model.name).toBeTruthy();
  });
});
