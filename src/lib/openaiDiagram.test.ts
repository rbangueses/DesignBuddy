import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateExcalidrawScene,
  generateMermaidFlowchart,
  modifyExcalidrawScene,
  modifyMermaidFlowchart,
} from "./openaiDiagram";

const generatedScene = {
  type: "excalidraw",
  version: 2,
  source: "openai",
  elements: [{ id: "box-1", type: "rectangle" }],
  appState: {},
  files: {},
};

describe("openaiDiagram", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests compact Excalidraw JSON with the selected model", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify(generatedScene),
      }),
    } as Response);

    const scene = await generateExcalidrawScene({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "draft",
      prompt: "A login flow",
    });

    expect(scene).toEqual(generatedScene);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
          "Content-Type": "application/json",
        }),
      }),
    );

    const requestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;

    expect(requestBody.model).toBe("gpt-5.4-mini");
    expect(requestBody.max_output_tokens).toBe(12_000);
    expect(JSON.stringify(requestBody)).toContain("A login flow");
    expect(JSON.stringify(requestBody)).toContain("compact");
  });

  it("allows larger outputs for balanced and high quality diagrams", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify(generatedScene),
      }),
    } as Response);

    await generateExcalidrawScene({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "balanced",
      prompt: "A larger routing flow",
    });
    await generateExcalidrawScene({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "high",
      prompt: "A polished architecture flow",
    });

    const balancedRequestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    const highRequestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[1]?.[1]?.body),
    ) as Record<string, unknown>;

    expect(balancedRequestBody.max_output_tokens).toBe(28_000);
    expect(highRequestBody.max_output_tokens).toBe(40_000);
  });

  it("sends the current scene and instruction when modifying a diagram", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify(generatedScene),
      }),
    } as Response);

    await modifyExcalidrawScene({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "balanced",
      instruction: "Add an observability box",
      scene: {
        type: "excalidraw",
        elements: [{ id: "existing", type: "rectangle" }],
        appState: { viewBackgroundColor: "#ffffff" },
        files: {},
      },
    });

    const requestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as {
      input: Array<{
        role: string;
        content: Array<{ text: string }>;
      }>;
    };
    const userMessage = requestBody.input.find((item) => item.role === "user");
    const userText = userMessage?.content[0]?.text ?? "";

    expect(userText).toContain("Modify the existing scene");
    expect(userText).toContain("Add an observability box");
    expect(userText).toContain("\"id\":\"existing\"");
  });

  it("extracts JSON from text responses that wrap it in prose", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: `Here is the file:\n${JSON.stringify(generatedScene)}`,
              },
            ],
          },
        ],
      }),
    } as Response);

    await expect(
      generateExcalidrawScene({
        apiKey: "sk-test",
        model: "gpt-5.4-mini",
        quality: "balanced",
        prompt: "A support escalation flow",
      }),
    ).resolves.toEqual(generatedScene);
  });

  it("rejects invalid Excalidraw JSON before it reaches storage", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({ type: "not-excalidraw", elements: [] }),
      }),
    } as Response);

    await expect(
      generateExcalidrawScene({
        apiKey: "sk-test",
        model: "gpt-5.4-mini",
        quality: "balanced",
        prompt: "Bad scene",
      }),
    ).rejects.toThrow("valid Excalidraw scene");
  });

  it("surfaces API errors with their response message", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Incorrect API key." } }),
    } as Response);

    await expect(
      generateExcalidrawScene({
        apiKey: "sk-test",
        model: "gpt-5.4-mini",
        quality: "balanced",
        prompt: "A diagram",
      }),
    ).rejects.toThrow("Incorrect API key.");
  });

  it("surfaces incomplete OpenAI responses as a retryable generation error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: "{\"type\":\"excalidraw\",\"elements\":[",
      }),
    } as Response);

    await expect(
      generateExcalidrawScene({
        apiKey: "sk-test",
        model: "gpt-5.4-mini",
        quality: "balanced",
        prompt: "A huge diagram",
      }),
    ).rejects.toThrow("ran out of output space");
  });

  it("replaces raw JSON parse errors with a useful message", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "{\"type\":\"excalidraw\",\"elements\":[",
      }),
    } as Response);

    await expect(
      generateExcalidrawScene({
        apiKey: "sk-test",
        model: "gpt-5.4-mini",
        quality: "balanced",
        prompt: "A diagram",
      }),
    ).rejects.toThrow("incomplete or invalid JSON");
  });

  it("times out requests that do not complete", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const request = generateExcalidrawScene({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "balanced",
      prompt: "A diagram",
      timeoutMs: 1000,
    });
    const expectation = expect(request).rejects.toThrow("timed out");

    await vi.advanceTimersByTimeAsync(1000);

    await expectation;
  });

  it("lets callers abort generation", async () => {
    const controller = new AbortController();
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const request = generateExcalidrawScene({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "balanced",
      prompt: "A diagram",
      signal: controller.signal,
    });

    controller.abort();

    await expect(request).rejects.toThrow("cancelled");
  });

  it("generates Mermaid source from OpenAI text output", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "flowchart LR\n  A[Start] --> B[Done]\n",
      }),
    } as Response);

    await expect(
      generateMermaidFlowchart({
        apiKey: "sk-test",
        model: "gpt-5.4-mini",
        quality: "draft",
        description: "simple process",
      }),
    ).resolves.toBe("flowchart LR\n  A[Start] --> B[Done]\n");

    const requestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as {
      max_output_tokens: number;
      reasoning: { effort: string };
      input: Array<{
        role: string;
        content: Array<{ text: string }>;
      }>;
    };
    const systemMessage = requestBody.input.find((item) => item.role === "system");
    const systemText = systemMessage?.content[0]?.text ?? "";

    expect(requestBody.max_output_tokens).toBe(4_000);
    expect(requestBody.reasoning.effort).toBe("low");
    expect(systemText).toContain("8 to 12 nodes maximum");
  });

  it("keeps Mermaid reasoning low across quality levels", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "flowchart LR\n  A[Start] --> B[Done]\n",
      }),
    } as Response);

    await generateMermaidFlowchart({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "balanced",
      description: "routing flow",
    });
    await generateMermaidFlowchart({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "high",
      description: "architecture flow",
    });

    const balancedRequestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as { max_output_tokens: number; reasoning: { effort: string } };
    const highRequestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[1]?.[1]?.body),
    ) as { max_output_tokens: number; reasoning: { effort: string } };

    expect(balancedRequestBody.max_output_tokens).toBe(8_000);
    expect(highRequestBody.max_output_tokens).toBe(12_000);
    expect(balancedRequestBody.reasoning.effort).toBe("low");
    expect(highRequestBody.reasoning.effort).toBe("low");
  });

  it("rejects non-flowchart Mermaid output", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: "sequenceDiagram\nA->>B: Hi" }),
    } as Response);

    await expect(
      generateMermaidFlowchart({
        apiKey: "sk-test",
        model: "gpt-5.4-mini",
        quality: "draft",
        description: "sequence",
      }),
    ).rejects.toThrow("Mermaid source must start with flowchart LR or flowchart TD.");
  });

  it("sends current Mermaid source and instruction when modifying Mermaid", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "flowchart TD\n  A[Start] --> B[Done]\n",
      }),
    } as Response);

    await modifyMermaidFlowchart({
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      quality: "balanced",
      source: "flowchart TD\n  A[Start]\n",
      instruction: "add end node",
    });

    const requestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as {
      input: Array<{
        role: string;
        content: Array<{ text: string }>;
      }>;
    };
    const userMessage = requestBody.input.find((item) => item.role === "user");
    const userText = userMessage?.content[0]?.text ?? "";

    expect(userText).toContain("add end node");
    expect(userText).toContain("flowchart TD");
  });
});
