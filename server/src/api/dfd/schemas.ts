/**
 * DFD API Validation Schemas
 */
import { z } from "zod";

export const CreateDFDSchema = z.object({
  name: z.string().min(1).max(255),
  level: z.enum(["CONTEXT", "PROCESS"]).optional(),
  parentDfdId: z.string().optional(),
});

export const UpdateDFDSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  canvasState: z
    .object({
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
      viewport: z
        .object({
          x: z.number(),
          y: z.number(),
          zoom: z.number(),
        })
        .optional(),
    })
    .optional(),
});

export const CreateProcessSchema = z.object({
  nodeId: z.string(),
  number: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  positionX: z.number(),
  positionY: z.number(),
  linkedComponentId: z.string().optional(),
});

export const UpdateProcessSchema = z.object({
  number: z.string().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  linkedComponentId: z.string().optional().nullable(),
});

export const CreateDataStoreSchema = z.object({
  nodeId: z.string(),
  number: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  dataTypes: z.array(z.string()).optional(),
  positionX: z.number(),
  positionY: z.number(),
  linkedComponentId: z.string().optional(),
});

export const UpdateDataStoreSchema = z.object({
  number: z.string().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  dataTypes: z.array(z.string()).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  linkedComponentId: z.string().optional().nullable(),
});

export const CreateExternalEntitySchema = z.object({
  nodeId: z.string(),
  name: z.string().min(1).max(255),
  entityType: z.enum(["USER", "SYSTEM", "SERVICE"]),
  description: z.string().optional(),
  positionX: z.number(),
  positionY: z.number(),
  linkedComponentId: z.string().optional(),
});

export const UpdateExternalEntitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  entityType: z.enum(["USER", "SYSTEM", "SERVICE"]).optional(),
  description: z.string().optional().nullable(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  linkedComponentId: z.string().optional().nullable(),
});

export const CreateDataFlowSchema = z.object({
  edgeId: z.string(),
  number: z.string().optional(),
  name: z.string().min(1).max(255),
  dataTypes: z.array(z.string()).optional(),
  volume: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  frequency: z.string().optional(),
  sourceProcessId: z.string().optional(),
  sourceDataStoreId: z.string().optional(),
  sourceEntityId: z.string().optional(),
  targetProcessId: z.string().optional(),
  targetDataStoreId: z.string().optional(),
  targetEntityId: z.string().optional(),
});

export const UpdateDataFlowSchema = z.object({
  number: z.string().optional().nullable(),
  name: z.string().min(1).max(255).optional(),
  dataTypes: z.array(z.string()).optional(),
  volume: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().nullable(),
  frequency: z.string().optional().nullable(),
});
