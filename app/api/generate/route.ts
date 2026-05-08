import { NextRequest } from "next/server";
import openai from "@/lib/openai";
import { connectToDatabase } from "@/lib/mongoose";
import Task from "@/lib/models/Task";
import { ITask } from "@/lib/models/Task";

export async function POST(request: NextRequest) {
  const { taskSlug, lang = "et" } = await request.json();

  await connectToDatabase();
  const task = await Task.findOne({ slug: taskSlug }).lean() as ITask | null;

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const isEt = lang === "et";
  const prompt = isEt
    ? `Oled matemaatikaõpetaja abiline. Loo 3 sarnast vaimset arvutusmängu ülesannet järgmise ülesande põhjal:

Ülesanne: ${task.problemEt}
Tehted: ${task.operation}
Raskusaste: ${task.difficulty}
Klassid: ${task.gradeMin}–${task.gradeMax}
Tuntud strateegiad: ${task.strategies.map((s) => s.nameEt).join(", ")}

Nõuded:
- Sarnane raskusaste ja tehted
- Erinevad arvud, kuid samad strateegiad töötavad hästi
- Iga ülesanne eraldi real
- Kirjuta ainult ülesanded, ilma selgitusteta
- Formaat: "1. [ülesanne] (vastus: [vastus])"

Vasta eesti keeles.`
    : `You are a math teacher assistant. Create 3 similar Number Talks problems based on this one:

Problem: ${task.problem}
Operation: ${task.operation}
Difficulty: ${task.difficulty}
Grades: ${task.gradeMin}–${task.gradeMax}
Known strategies: ${task.strategies.map((s) => s.name).join(", ")}

Requirements:
- Similar difficulty and operation
- Different numbers, but same strategies work well
- Each problem on a separate line
- Output only the problems, no explanations
- Format: "1. [problem] (answer: [answer])"`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 300,
  });

  const text = response.choices[0].message.content ?? "";
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+\./.test(l));

  return Response.json({ problems: lines });
}
