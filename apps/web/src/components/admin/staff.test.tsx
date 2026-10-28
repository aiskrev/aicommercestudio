import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffRoles } from "@/components/admin/StaffRoles";
import { adminDictionaries } from "@/i18n/admin";
import { ApiError } from "@/lib/admin-api";
import type { StaffMember } from "@/lib/admin-types";

const fetchMock = vi.fn();
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<typeof import("@/lib/admin-api")>()),
  adminFetch: (path: string, init?: RequestInit) => fetchMock(path, init),
}));

const t = adminDictionaries.bg.staff;
const me: StaffMember = { id: "u1", email: "admin@example.com", full_name: "Админ", role: "admin", is_active: true, last_login_at: "2026-10-28T09:00:00Z", is_self: true };
const editor: StaffMember = { id: "u2", email: "editor@example.com", full_name: "Редактор", role: "viewer", is_active: true, last_login_at: null, is_self: false };

afterEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => new Promise(() => {}));
});

describe("staff roles", () => {
  it("changes another member's role and cannot change one's own", async () => {
    fetchMock.mockImplementation(async (_path: string, init?: RequestInit) =>
      init?.method === "PATCH" ? { ...editor, role: JSON.parse(init.body as string).role } : [me, editor],
    );
    render(<StaffRoles />);
    const table = await screen.findByTestId("staff-table");
    const [, ownRow, otherRow] = within(table).getAllByRole("row");
    expect(within(ownRow).getByRole("combobox")).toBeDisabled();
    expect(within(ownRow).getByText(t.ownRole)).toBeInTheDocument();
    expect(within(otherRow).getByText(t.never)).toBeInTheDocument();

    const save = within(otherRow).getByRole("button", { name: t.save });
    expect(save).toBeDisabled();
    fireEvent.change(within(otherRow).getByRole("combobox"), { target: { value: "editor" } });
    fireEvent.click(save);
    expect(await screen.findByRole("status")).toHaveTextContent("Редактор");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/staff/u2", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ role: "editor" }) }));
    expect(within(otherRow).getByRole("combobox")).toHaveValue("editor");
  });

  it("shows the API's refusal", async () => {
    fetchMock.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === "PATCH") throw new ApiError(409, "Трябва да остане поне един активен администратор.", {}, "last_admin");
      return [me, { ...editor, role: "admin" }];
    });
    render(<StaffRoles />);
    const otherRow = within(await screen.findByTestId("staff-table")).getAllByRole("row")[2];
    fireEvent.change(within(otherRow).getByRole("combobox"), { target: { value: "viewer" } });
    fireEvent.click(within(otherRow).getByRole("button", { name: t.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Трябва да остане поне един активен администратор.");
  });

  it("shows an error state when the list cannot be loaded", async () => {
    fetchMock.mockRejectedValue(new ApiError(403, "Ролята ви не позволява това действие.", {}, "forbidden_role"));
    render(<StaffRoles />);
    expect(await screen.findByText("Ролята ви не позволява това действие.")).toBeInTheDocument();
  });
});
