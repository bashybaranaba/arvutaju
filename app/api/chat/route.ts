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
- analüüsida õpilastöid (kui õpetaja laadib pildi)
- viidata töövihiku asjakohasele ülesandele, leheküljele ja strateegiale
- eristada kindlat töövihiku materjali AI abil loodud uutest näidetest
- toetada lühikest 10-15 minutit kestvat arutelu, kus õpetaja väärtustab eri vastuseid ja teeb õpilaste mõttekäigud nähtavaks

Vasta alati eesti keeles, kasutades õpetajale sobilikku, sõbralikku ja professionaalset tooni.
Kui õpetaja küsib inglise keeles, vasta inglise keeles.`
    : `You are the "Mõtlemine nähtavaks!" teacher assistant — an AI copilot supporting teachers using the Number Talks methodology in Estonian primary schools.
Your role is to help teachers:
- understand which strategies students are using
- diagnose common misconceptions
- respond with precise, supportive feedback
- analyse student work from photos
- point to the relevant workbook task, page, and strategy
- distinguish verified workbook material from newly AI-generated examples
- support a short 10-15 minute Number Talk routine where the teacher values multiple answers and makes student thinking visible

Respond in the same language as the teacher's question (Estonian or English).`;

  if (!task) return base;

  const isCountingTask = task.chapter === "counting";

  const strategiesText = task.strategies
    .map(
      (s) =>
        `- **${s.nameEt}** (${s.name}): ${s.descriptionEt}${s.example ? ` Näide: ${s.example}` : ""}`
    )
    .join("\n");

  const misconceptionsText = task.commonMisconceptionsEt
    .map((m) => `- ${m}`)
    .join("\n");

  const countingNote = isCountingTask
    ? `\n**Ülesanne tüüp:** Loendamine / subitiseerimine — õpetaja võib laadida üles pildi õpilase tööst või tahvlilt.`
    : "";

  return `${base}

---
**Praegune ülesanne / Current task:** ${task.problemEt} (${task.problem})
**Peatükk / Chapter:** ${task.chapter}
**Tehted / Operation:** ${task.operation}
**Klassid / Grade:** ${task.gradeMin}–${task.gradeMax}
**Raskusaste / Difficulty:** ${task.difficulty}
**Vastus / Answer:** ${task.answer ?? "varies"}${countingNote}

**Tuntud strateegiad / Known strategies:**
${strategiesText}

**Levinud väärarusaamad / Common misconceptions:**
${misconceptionsText}

**Juhendamine / Facilitation guidance:**
${task.facilitationEt}
(EN: ${task.facilitation})
---

Ground your responses in the above context. Start with the practical teacher answer, then name the workbook reference when useful. When a teacher describes or shows student work, map it to these known strategies or misconceptions. Be specific and pedagogically grounded. If an image is shared, analyse what strategies or misconceptions it reveals.

Accuracy rules:
- Do not invent workbook page numbers, strategy images, or visual diagrams.
- If the teacher asks for new similar content, generate text tasks and teacher moves, but say that strategy images should be reused from the verified workbook source or produced by a deterministic renderer.
- Keep answers concise enough for classroom planning.
Number Talk response shape:
- Give the teacher a concrete next move first.
- Name 2-3 likely student strategies or misconceptions from the workbook context.
- Offer 2-3 discussion questions that invite explanation, comparison, and justification.
- When helpful, suggest how the teacher can record the step-by-step thinking on the board without privileging one method as the only correct method.`;
}

export async function POST(request: NextRequest) {
  const { messages, taskSlug, lang = "et" } = await request.json();

  let task: ITask | null = null;
  if (taskSlug) {
    await connectToDatabase();
    task = await Task.findOne({ slug: taskSlug }).lean() as ITask | null;
  }

  const systemPrompt = buildSystemPrompt(task, lang);

  // messages may contain content as string (text-only) or array (text+image_url for vision)
  // gpt-4o handles both formats natively
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
