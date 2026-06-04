"use server";

import {
  loadAccountReadModel,
  loadCommandPaletteIndexReadModel,
  loadDashboardReadModel,
  loadViewDetailReadModel,
  loadViewsIndexReadModel,
} from "@/lib/workspace/read-models";
import type {
  AccountReadModel,
  CommandPaletteIndexReadModel,
  DashboardReadModel,
  DashboardReadModelRequest,
  ViewDetailReadModel,
  ViewsIndexReadModel,
} from "@/lib/workspace/workspace-types";

import { requireWorkspaceContext } from "./session";

export async function getDashboardReadModelAction(
  request: DashboardReadModelRequest = {},
): Promise<DashboardReadModel> {
  const { workspaceId, supabase, userId } = await requireWorkspaceContext();
  return loadDashboardReadModel(workspaceId, request, supabase, userId);
}

export async function getAccountReadModelAction(): Promise<AccountReadModel> {
  const { workspaceId } = await requireWorkspaceContext();
  return loadAccountReadModel(workspaceId);
}

export async function getViewsIndexReadModelAction(): Promise<ViewsIndexReadModel> {
  const { workspaceId } = await requireWorkspaceContext();
  return loadViewsIndexReadModel(workspaceId);
}

export async function getViewDetailReadModelAction(): Promise<ViewDetailReadModel> {
  const { workspaceId } = await requireWorkspaceContext();
  return loadViewDetailReadModel(workspaceId);
}

export async function getCommandPaletteIndexReadModelAction(): Promise<CommandPaletteIndexReadModel> {
  const { workspaceId } = await requireWorkspaceContext();
  return loadCommandPaletteIndexReadModel(workspaceId);
}
