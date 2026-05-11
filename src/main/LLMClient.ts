import { WebContents } from "electron";
import { streamText, type LanguageModel, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import * as dotenv from "dotenv";
import { join } from "path";
import { IPC } from "../shared/ipc-channels";
import type { ChatRequest, StreamChunk } from "../shared/types";
import type { Window } from "./Window";

dotenv.config({ path: join(__dirname, "../../.env") });

type LLMProvider = "openai" | "anthropic";

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-20241022",
};

const MAX_CONTEXT_LENGTH = 4000;
const DEFAULT_TEMPERATURE = 0.7;

export class LLMClient {
  private readonly webContents: WebContents;
  private window: Window | null = null;
  private readonly provider: LLMProvider;
  private readonly modelName: string;
  private readonly model: LanguageModel | null;
  private messages: ModelMessage[] = [];

  constructor(webContents: WebContents) {
    this.webContents = webContents;
    this.provider = this.getProvider();
    this.modelName = this.getModelName();
    this.model = this.initializeModel();
    this.logInitializationStatus();
  }

  // Deferred setter to avoid circular dependency with Window
  setWindow(window: Window): void {
    this.window = window;
  }

  private getProvider(): LLMProvider {
    const provider = process.env.LLM_PROVIDER?.toLowerCase();
    if (provider === "anthropic") return "anthropic";
    return "openai";
  }

  private getModelName(): string {
    return process.env.LLM_MODEL || DEFAULT_MODELS[this.provider];
  }

  private initializeModel(): LanguageModel | null {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    switch (this.provider) {
      case "anthropic":
        return anthropic(this.modelName);
      case "openai":
        return openai(this.modelName);
      default:
        return null;
    }
  }

  private getApiKey(): string | undefined {
    switch (this.provider) {
      case "anthropic":
        return process.env.ANTHROPIC_API_KEY;
      case "openai":
        return process.env.OPENAI_API_KEY;
      default:
        return undefined;
    }
  }

  private logInitializationStatus(): void {
    if (this.model) {
      console.log(
        `✅ LLM Client initialized with ${this.provider} provider using model: ${this.modelName}`
      );
    } else {
      const keyName =
        this.provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
      console.error(
        `❌ LLM Client initialization failed: ${keyName} not found in environment variables.\n` +
          `Please add your API key to the .env file in the project root.`
      );
    }
  }

  async sendChatMessage(request: ChatRequest): Promise<void> {
    try {
      let screenshot: string | null = null;
      if (this.window?.activeTab) {
        try {
          const image = await this.window.activeTab.screenshot();
          screenshot = image.toDataURL();
        } catch (error) {
          console.error("Failed to capture screenshot:", error);
        }
      }

      const userContent: any[] = [];

      if (screenshot) {
        userContent.push({ type: "image", image: screenshot });
      }

      userContent.push({ type: "text", text: request.message });

      const userMessage: ModelMessage = {
        role: "user",
        content: userContent.length === 1 ? request.message : userContent,
      };

      this.messages.push(userMessage);
      this.sendMessagesToRenderer();

      if (!this.model) {
        this.sendErrorMessage(
          request.messageId,
          "LLM service is not configured. Please add your API key to the .env file."
        );
        return;
      }

      const messages = await this.prepareMessagesWithContext();
      await this.streamResponse(messages, request.messageId);
    } catch (error) {
      console.error("Error in LLM request:", error);
      this.handleStreamError(error, request.messageId);
    }
  }

  clearMessages(): void {
    this.messages = [];
    this.sendMessagesToRenderer();
  }

  getMessages(): ModelMessage[] {
    return this.messages;
  }

  private sendMessagesToRenderer(): void {
    this.webContents.send(IPC.CHAT_MESSAGES_UPDATED, this.messages);
  }

  private async prepareMessagesWithContext(): Promise<ModelMessage[]> {
    let pageUrl: string | null = null;
    let pageText: string | null = null;

    if (this.window?.activeTab) {
      pageUrl = this.window.activeTab.url;
      try {
        pageText = await this.window.activeTab.getTabText();
      } catch (error) {
        console.error("Failed to get page text:", error);
      }
    }

    const systemMessage: ModelMessage = {
      role: "system",
      content: this.buildSystemPrompt(pageUrl, pageText),
    };

    return [systemMessage, ...this.messages];
  }

  private buildSystemPrompt(url: string | null, pageText: string | null): string {
    const parts: string[] = [
      "You are a helpful AI assistant integrated into a web browser.",
      "You can analyze and discuss web pages with the user.",
      "The user's messages may include screenshots of the current page as the first image.",
    ];

    if (url) {
      parts.push(`\nCurrent page URL: ${url}`);
    }

    if (pageText) {
      const truncatedText = this.truncateText(pageText, MAX_CONTEXT_LENGTH);
      parts.push(`\nPage content (text):\n${truncatedText}`);
    }

    parts.push(
      "\nPlease provide helpful, accurate, and contextual responses about the current webpage.",
      "If the user asks about specific content, refer to the page content and/or screenshot provided."
    );

    return parts.join("\n");
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  private async streamResponse(
    messages: ModelMessage[],
    messageId: string
  ): Promise<void> {
    if (!this.model) throw new Error("Model not initialized");

    const result = await streamText({
      model: this.model,
      messages,
      temperature: DEFAULT_TEMPERATURE,
      maxRetries: 3,
    });

    await this.processStream(result.textStream, messageId);
  }

  private async processStream(
    textStream: AsyncIterable<string>,
    messageId: string
  ): Promise<void> {
    let accumulatedText = "";

    const messageIndex = this.messages.length;
    this.messages.push({ role: "assistant", content: "" });

    for await (const chunk of textStream) {
      accumulatedText += chunk;

      this.messages[messageIndex] = { role: "assistant", content: accumulatedText };
      this.sendMessagesToRenderer();
      this.sendStreamChunk(messageId, { content: chunk, isComplete: false });
    }

    this.messages[messageIndex] = { role: "assistant", content: accumulatedText };
    this.sendMessagesToRenderer();
    this.sendStreamChunk(messageId, { content: accumulatedText, isComplete: true });
  }

  private handleStreamError(error: unknown, messageId: string): void {
    console.error("Error streaming from LLM:", error);
    this.sendErrorMessage(messageId, this.getErrorMessage(error));
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return "An unexpected error occurred. Please try again.";
    }

    const msg = error.message.toLowerCase();

    if (msg.includes("401") || msg.includes("unauthorized"))
      return "Authentication error: Please check your API key in the .env file.";
    if (msg.includes("429") || msg.includes("rate limit"))
      return "Rate limit exceeded. Please try again in a few moments.";
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("econnrefused"))
      return "Network error: Please check your internet connection.";
    if (msg.includes("timeout"))
      return "Request timeout: The service took too long to respond. Please try again.";

    return "Sorry, I encountered an error while processing your request. Please try again.";
  }

  private sendErrorMessage(messageId: string, errorMessage: string): void {
    this.sendStreamChunk(messageId, { content: errorMessage, isComplete: true });
  }

  private sendStreamChunk(messageId: string, chunk: StreamChunk): void {
    this.webContents.send(IPC.CHAT_RESPONSE, {
      messageId,
      content: chunk.content,
      isComplete: chunk.isComplete,
    });
  }
}
