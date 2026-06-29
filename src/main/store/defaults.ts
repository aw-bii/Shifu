import { ConvStore } from "./index";

export function seedDefaults(): void {
  if (ConvStore.getSetting("defaults_seeded")) return;

  ConvStore.createPersona({
    name: "Coder",
    systemPrompt:
      "You are an expert software engineer. Be concise, use code blocks, prefer working solutions over explanations.",
    isDefault: true,
  });

  ConvStore.createPersona({
    name: "Explainer",
    systemPrompt:
      "You are a patient teacher. Explain concepts clearly using plain language and examples. Avoid jargon.",
    isDefault: false,
  });

  ConvStore.createPipelineTemplate("Draft → Review", [
    { stepOrder: 0, backendId: "claude", personaId: null },
    { stepOrder: 1, backendId: "claude", personaId: null },
  ]);

  ConvStore.setSetting("defaults_seeded", "true");
}
