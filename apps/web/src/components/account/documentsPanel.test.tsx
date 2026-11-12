import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentsPanel } from "@/components/account/DocumentsPanel";
import { locales } from "@/i18n/config";
import { projectTexts } from "@/i18n/projects";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = vi.fn();
const t = projectTexts.bg.documents;
const reply = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const PROJECT = "11111111-2222-4333-8444-555555555555";
const DOC = "aaaaaaaa-2222-4333-8444-555555555555";
const APPROVAL = "bbbbbbbb-2222-4333-8444-555555555555";
const LIMITS = {
  max_bytes: 10 * 1024 * 1024,
  extensions: [
    { extension: ".pdf", content_type: "application/pdf" },
    { extension: ".png", content_type: "image/png" },
  ],
  categories: ["brief", "design", "deliverable", "contract", "report", "feedback", "other"],
  client_categories: ["brief", "feedback", "other"],
  upload: true,
  client_upload: true,
};
const version = (over: object = {}) => ({
  number: 1,
  filename: "Макет.pdf",
  content_type: "application/pdf",
  size_bytes: 2048,
  sha256: "a".repeat(64),
  note: "Първи вариант",
  state: "published",
  published_at: "2026-11-10T10:00:00Z",
  created_at: "2026-11-10T09:00:00Z",
  uploaded_by: "team",
  mine: false,
  downloadable: true,
  approval: null,
  ...over,
});
const pending = { id: APPROVAL, version: 1, state: "pending", message: "Моля, одобрете", requested_at: "2026-11-10T11:00:00Z", decided_at: null, decision_note: null, decided_by: null };
const VIEW = {
  documents: [{ id: DOC, title: "Дизайн на сайта", category: "design", origin: "staff", revision: 2, created_at: "2026-11-10T09:00:00Z", versions: [version({ approval: pending })], comments: [], can_add_version: false }],
  limits: LIMITS,
  can_decide: true,
};

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("DocumentsPanel", () => {
  it("stays out of sight while documents are off, and says so when the list cannot be loaded", async () => {
    fetchMock.mockImplementation(() => reply(404, { code: "not_found" }));
    const off = render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(off.container).toBeEmptyDOMElement();
    off.unmount();
    fetchMock.mockImplementation(() => reply(500, { code: "error" }));
    render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    expect(await screen.findByText(t.failed)).toBeInTheDocument();
  });

  it("lists a document with its version, size and checksum, and downloads through a plain link to the API", async () => {
    fetchMock.mockImplementation(() => reply(200, VIEW));
    render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    const list = await screen.findByTestId("documents-list");
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/projects/${PROJECT}/documents`);
    expect(list).toHaveTextContent("Дизайн на сайта");
    expect(list).toHaveTextContent("Макет.pdf");
    expect(list).toHaveTextContent("2 KB");
    expect(list).toHaveTextContent("a".repeat(64));
    const link = within(list).getByTestId("document-download");
    expect(link).toHaveAttribute("href", `/api/projects/${PROJECT}/documents/${DOC}/versions/1/download`);
    expect(link).toHaveAttribute("download", "Макет.pdf");
  });

  it("offers no download for a file that is not downloadable and says why", async () => {
    fetchMock.mockImplementation(() => reply(200, { ...VIEW, documents: [{ ...VIEW.documents[0], versions: [version({ downloadable: false })] }] }));
    render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    await screen.findByTestId("documents-list");
    expect(screen.queryByTestId("document-download")).not.toBeInTheDocument();
    expect(screen.getByText(t.scanPending)).toBeInTheDocument();
  });

  it("asks for the statement before an approval and posts the version the person saw", async () => {
    const user = userEvent.setup();
    const decided = { ...VIEW, documents: [{ ...VIEW.documents[0], versions: [version({ approval: { ...pending, state: "approved", decided_at: "2026-11-10T12:00:00Z", decided_by: "you", decision_note: "Супер" } })] }] };
    fetchMock.mockImplementation((url: string, init: RequestInit) => (init.method === "POST" ? reply(200, decided) : reply(200, VIEW)));
    render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    const card = await screen.findByTestId("approval-request");
    expect(card).toHaveTextContent("Моля, одобрете");
    await user.click(within(card).getByRole("button", { name: t.approval.approve }));
    expect(await screen.findByText(t.approval.confirmNeeded)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(within(card).getByRole("checkbox"));
    await user.type(within(card).getByRole("textbox"), "Супер");
    await user.click(within(card).getByRole("button", { name: t.approval.approve }));
    await waitFor(() => expect(screen.queryByTestId("approval-request")).not.toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`/api/projects/${PROJECT}/approvals/${APPROVAL}/decision`);
    expect(JSON.parse(init.body)).toEqual({ expected_version: 1, decision: "approve", comment: "Супер" });
    expect(screen.getByText(t.approval.approved)).toBeInTheDocument();
  });

  it("needs a reason to reject, and explains a version that changed meanwhile", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init: RequestInit) => (init.method === "POST" ? reply(409, { code: "approval_superseded", detail: "x" }) : reply(200, VIEW)));
    render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    const card = await screen.findByTestId("approval-request");
    await user.click(within(card).getByRole("button", { name: t.approval.reject }));
    expect(await screen.findByText(t.approval.commentRequired)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.type(within(card).getByRole("textbox"), "По-голямо лого");
    await user.click(within(card).getByRole("button", { name: t.approval.reject }));
    expect(await screen.findByText(t.approval.stale)).toBeInTheDocument();
  });

  it("shows a member without the approver role who decides, and offers no decision", async () => {
    fetchMock.mockImplementation(() => reply(200, { ...VIEW, can_decide: false }));
    render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    const card = await screen.findByTestId("approval-request");
    expect(within(card).getByTestId("approval-owners-only")).toHaveTextContent(t.approval.onlyOwners);
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("sends feedback for the latest version", async () => {
    const user = userEvent.setup();
    const commented = { ...VIEW, documents: [{ ...VIEW.documents[0], comments: [{ id: "c1", version: 1, author: "client", mine: true, body: "По-голям шрифт", created_at: "2026-11-10T12:00:00Z" }] }] };
    fetchMock.mockImplementation((url: string, init: RequestInit) => (init.method === "POST" ? reply(201, commented) : reply(200, VIEW)));
    render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    const box = await screen.findByTestId("document-comments");
    await user.click(within(box).getByRole("button", { name: t.comments.send }));
    expect(await within(box).findByText(t.comments.tooShort)).toBeInTheDocument();
    await user.type(within(box).getByRole("textbox"), "По-голям шрифт");
    await user.click(within(box).getByRole("button", { name: t.comments.send }));
    await waitFor(() => expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ version: 1, body: "По-голям шрифт" }));
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/projects/${PROJECT}/documents/${DOC}/comments`);
    expect(await within(screen.getByTestId("document-comments")).findByText("По-голям шрифт")).toBeInTheDocument();
  });

  it("uploads a file as the raw body with its details in encoded headers, and maps the refusals", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init: RequestInit) => (init.method === "POST" ? reply(422, { code: "file_type_not_allowed", detail: "x" }) : reply(200, { ...VIEW, documents: [] })));
    render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    const form = await screen.findByTestId("document-upload-form");
    await user.click(within(form).getByRole("button", { name: t.upload.send }));
    expect(await within(form).findByText(t.upload.noFile)).toBeInTheDocument();
    const file = new File(["%PDF-1.7"], "Задание 1.pdf", { type: "application/pdf" });
    await user.upload(within(form).getByLabelText(t.upload.file), file);
    await user.type(within(form).getByLabelText(t.upload.docTitle), "Задание");
    await user.click(within(form).getByRole("button", { name: t.upload.send }));
    expect(await within(form).findByText(t.upload.type)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`/api/projects/${PROJECT}/documents`);
    expect(init.body).toBe(file);
    const sent = init.headers as Headers;
    expect(sent.get("Content-Type")).toBe("application/octet-stream");
    expect(decodeURIComponent(sent.get("X-File-Name") ?? "")).toBe("Задание 1.pdf");
    expect(decodeURIComponent(sent.get("X-Document-Title") ?? "")).toBe("Задание");
    expect(sent.get("X-Document-Category")).toBe("brief");
  });

  it("offers no upload form when the server does not allow customer uploads", async () => {
    fetchMock.mockImplementation(() => reply(200, { ...VIEW, limits: { ...LIMITS, client_upload: false } }));
    render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    await screen.findByTestId("documents-list");
    expect(screen.queryByTestId("document-upload-form")).not.toBeInTheDocument();
    expect(screen.getByText(t.upload.closed)).toBeInTheDocument();
  });

  it("adds a new version of a document the customer's side started, naming the version it saw", async () => {
    const user = userEvent.setup();
    const mine = { ...VIEW.documents[0], origin: "client", can_add_version: true, versions: [version({ mine: true, uploaded_by: "client", approval: null })] };
    fetchMock.mockImplementation((url: string, init: RequestInit) => (init.method === "POST" ? reply(201, { ...VIEW, documents: [mine] }) : reply(200, { ...VIEW, documents: [mine] })));
    render(<DocumentsPanel locale="bg" projectId={PROJECT} />);
    const form = await screen.findByTestId("document-version-form");
    await user.upload(within(form).getByLabelText(t.upload.file), new File(["%PDF-1.7 v2"], "v2.pdf"));
    await user.click(within(form).getByRole("button", { name: t.upload.send }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`/api/projects/${PROJECT}/documents/${DOC}/versions`);
    expect((init.headers as Headers).get("X-Expected-Version")).toBe("1");
  });
});

describe("texts", () => {
  it("have the same keys in both languages", () => {
    const keys = (value: object): string[] =>
      Object.entries(value).flatMap(([key, item]) => (item && typeof item === "object" ? keys(item).map((inner) => `${key}.${inner}`) : [key]));
    expect(keys(projectTexts.en.documents)).toEqual(keys(projectTexts.bg.documents));
    for (const locale of locales) expect(JSON.stringify(projectTexts[locale].documents)).not.toMatch(/гарантир|guarantee|virus.free|безопасен файл/i);
  });
});
