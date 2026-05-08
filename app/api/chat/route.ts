import { NextRequest } from "next/server";
import openai from "@/lib/openai";
import { connectToDatabase } from "@/lib/mongoose";
import Task from "@/lib/models/Task";
import { ITask } from "@/lib/models/Task";

function buildSystemPrompt(task: ITask | null, lang: string): string {
  const isEt = lang === "et";

  const base = isEt
    ? `Oled "Mõtlemine nähtavaks!" õpetaja abiline — AI-abimees, mis toetab õpetajaid Number Talks meetodi kasutamisel Eesti algklassides.
Sinu ülesanne on aidata õpetajatel:
- mõista, milliseid strateegiaid õpilased kasutavad
- diagnoosida levinud väärarusaamu
- reageerida täpse ja toetava tagasisidega
- genereerida sarnaseid ülesandeid

Vasta alati eesti keeles, kasutades õpetajale sobilikku, sõbralikku ja professionaalset tooni.
Kui õpetaja küsib inglise keeles, vasta inglise keeles.`
    : `You are the "Mõtlemine nähtavaks!" teacher assistant — an AI copilot supporting teachers using the Number Talks methodology in Estonian primary schools.
Your role is to help teachers:
- understand which strategies students are using
- diagnose common misconceptions
- respond with precise, supportive feedback
- generate similar practice problems

Respond in the same language as the teacher's question (Estonian or English).`;

  if (!task) return base;

  const strategiesText = task.strategies
    .map(
      (s) =>
        `- **${s.nameEt}** (${s.name}): ${s.descriptionEt}${s.example ? ` Näide: ${s.example}` : ""}`
    )
    .join("\n");

  const misconceptionsText = task.commonMisconceptionsEt
    .map((m) => `- ${m}`)
    .join("\n");

  return `${base}

---
**Praegune ülesanne / Current task:** ${task.problemEt} (${task.problem})
**Tehted / Operation:** ${task.operation}
**Klassid / Grade:** ${task.gradeMin}–${task.gradeMax}
**Raskusaste / Difficulty:** ${task.difficulty}
**Vastus / Answer:** ${task.answer ?? "not specified"}

**Tuntud strateegiad / Known strategies:**
${strategiesText}

**Levinud väärarusaamad / Common misconceptions:**
${misconceptionsText}

**Juhendamine / Facilitation guidance:**
${task.facilitationEt}
(EN: ${task.facilitation})
---

Ground your responses in the above context. When a teacher describes student work, map it to these known strategies or misconceptions. Be specific and pedagogically grounded.`;
}

export async function POST(request: NextRequest) {
  const { messages, taskSlug, lang = "et" } = await request.json();

  let task: ITask | null = null;
  if (taskSlug) {
    await connectToDatabase();
    task = await Task.findOne({ slug: taskSlug }).lean() as ITask | null;
  }

  const systemPrompt = buildSystemPrompt(task, lang);

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    temperature: 0.4,
    max_tokens: 1024,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) {
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
