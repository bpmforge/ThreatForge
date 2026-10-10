/**
 * Document Parsing API
 *
 * Parses PDF and DOCX files into plain text for AI extraction.
 * Used by the document import feature to extract architecture from uploaded files.
 */
import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import {
  sendSuccess,
  sendBadRequest,
  sendInternalError,
} from "../utils/api-response.js";
import logger from "../utils/logger.js";
import { routeAuthz } from "../middleware/authz-policy.js";
import { checkZipLimits } from "../utils/zip-guard.js";

const AUTHENTICATED = routeAuthz("authenticated");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const documentRoutes: FastifyPluginAsync = async (server) => {
  // Register multipart support for this plugin
  await server.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });

  /**
   * POST /api/documents/parse
   * Parse a PDF or DOCX file into plain text with metadata.
   *
   * Accepts: multipart/form-data with 'file' field
   * Returns: { text: string, metadata: { wordCount, title?, pageCount? } }
   */
  server.post("/api/documents/parse", AUTHENTICATED, async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return sendBadRequest(reply, "No file uploaded");
      }

      const { mimetype, filename } = data;
      const buffer = await data.toBuffer();

      if (buffer.length === 0) {
        return sendBadRequest(reply, "Empty file");
      }

      // Determine parser based on file type
      const ext = filename?.split(".").pop()?.toLowerCase();
      let text = "";
      let metadata: Record<string, unknown> = {};

      if (mimetype === "application/pdf" || ext === "pdf") {
        // Parse PDF using pdf-parse v2 (named export PDFParse, not default)
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({});
        await (
          parser as unknown as { load: (b: Buffer) => Promise<void> }
        ).load(buffer);
        const info = (await parser.getInfo()) as unknown as Record<
          string,
          unknown
        >;

        text = (await parser.getText()).text || "";
        metadata = {
          title: (info as Record<string, unknown>)?.Title || filename,
          author: (info as Record<string, unknown>)?.Author,
          wordCount: text.split(/\s+/).filter(Boolean).length,
        };
      } else if (
        mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        ext === "docx"
      ) {
        // Refuse decompression bombs before anything is inflated
        const zipProblem = checkZipLimits(buffer);
        if (zipProblem) return sendBadRequest(reply, zipProblem);
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });

        text = result.value;
        metadata = {
          title: filename,
          wordCount: text.split(/\s+/).filter(Boolean).length,
        };

        if (result.messages.length > 0) {
          metadata.warnings = result.messages.map((m) => m.message);
        }
      } else if (ext === "txt" || ext === "md" || ext === "html") {
        // Plain text / markdown / HTML — just read as text
        text = buffer.toString("utf-8");
        metadata = {
          title: filename,
          wordCount: text.split(/\s+/).filter(Boolean).length,
        };
      } else {
        return sendBadRequest(
          reply,
          `Unsupported file type: ${mimetype || ext}. Supported: PDF, DOCX, TXT, MD, HTML`,
        );
      }

      if (!text || text.trim().length === 0) {
        return sendBadRequest(
          reply,
          "Could not extract text from file. The file may be image-based or empty.",
        );
      }

      logger.info(
        {
          filename,
          mimetype,
          textLength: text.length,
          wordCount: metadata.wordCount,
        },
        "Document parsed successfully",
      );

      return sendSuccess(reply, {
        text,
        metadata,
        rawContent: buffer.toString("base64"),
      });
    } catch (err) {
      logger.error({ err }, "Failed to parse document");
      return sendInternalError(reply, "Failed to parse document");
    }
  });
};
