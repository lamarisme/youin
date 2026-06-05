"use server";

import {
  getAccountReadModelForCurrentWorkspace,
  getCommandPaletteIndexReadModelForCurrentWorkspace,
  getDashboardReadModelForCurrentWorkspace,
  getViewDetailReadModelForCurrentWorkspace,
  getViewsIndexReadModelForCurrentWorkspace,
} from "@/lib/workspace/server-read-models";
import type {
  AccountReadModel,
  CommandPaletteIndexReadModel,
  DashboardReadModel,
  DashboardReadModelRequest,
  ViewDetailReadModel,
  ViewsIndexReadModel,
} from "@/lib/workspace/workspace-types";

export async function getDashboardReadModelAction(
  request: DashboardReadModelRequest = {},
): Promise<DashboardReadModel> {
  return getDashboardReadModelForCurrentWorkspace(request);
}

export async function getAccountReadModelAction(): Promise<AccountReadModel> {
  return getAccountReadModelForCurrentWorkspace();
}

export async function getViewsIndexReadModelAction(): Promise<ViewsIndexReadModel> {
  return getViewsIndexReadModelForCurrentWorkspace();
}

export async function getViewDetailReadModelAction(): Promise<ViewDetailReadModel> {
  return getViewDetailReadModelForCurrentWorkspace();
}

export async function getCommandPaletteIndexReadModelAction(): Promise<CommandPaletteIndexReadModel> {
  return getCommandPaletteIndexReadModelForCurrentWorkspace();
}
